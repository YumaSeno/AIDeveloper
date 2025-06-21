import {
  ContentListUnion,
  GenerateContentConfig,
  GoogleGenAI,
} from "@google/genai";
import {
  getTurnOutputSchemaWithTools,
  ToolResult,
  TurnOutput,
} from "../models";
import { z } from "zod";
import { Agent } from "./Agent";
import { Tool } from "../tools/Tool";
import { toGeminiSchema } from "../core/ZodSchemaConverter";

export class AIAgent extends Agent {
  protected readonly client: GoogleGenAI;
  protected readonly modelName: string;

  constructor(args: {
    client: GoogleGenAI;
    name: string;
    role: string;
    projectRole: string;
    detailedInstructions: string;
    modelName: string;
  }) {
    super({
      name: args.name,
      role: args.role,
      projectRole: args.projectRole,
      detailedInstructions: args.detailedInstructions,
    });
    this.client = args.client;
    this.modelName = args.modelName;
  }

  protected async _executeJson(
    prompt: string,
    responseSchema: z.ZodTypeAny,
    base64ImageFile: string | undefined = undefined
  ): Promise<z.infer<typeof responseSchema>> {
    const config: GenerateContentConfig = {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(responseSchema),
    };

    let error_count = 0;
    while (true) {
      try {
        const contents: ContentListUnion = [prompt];
        if (base64ImageFile) {
          contents.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64ImageFile,
            },
          });
        }
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: contents,
          config: config,
        });

        if (!response.text)
          throw new Error(
            "geminiからの回答に一切テキストが含まれませんでした。"
          );
        const parsed = JSON.parse(response.text);

        const delete_keys: string[] = [];
        for (const key in parsed) {
          if (parsed[key] === null || parsed[key] === undefined)
            delete_keys.push(key);
        }
        for (const delete_key of delete_keys) delete parsed[delete_key];
        return responseSchema.parse(parsed);
      } catch (e) {
        error_count++;
        if (error_count > 3) {
          console.warn(
            `警告: API呼び出し中に3回連続でエラーが発生しました: ${e}。異常終了します。`
          );
          throw e;
        }
        console.warn(
          `警告: API呼び出し中にエラーが発生しました: ${e}。30秒待機してリトライします。`
        );
        await new Promise((res) => setTimeout(res, 30000));
      }
    }
  }

  organizeHistory(
    personalHistory: (TurnOutput | ToolResult)[],
    tools: Tool[]
  ): {
    historyForPrompt: (TurnOutput | ToolResult)[];
    base64ImageFile: string | undefined;
  } {
    const toolRecord: Record<string, Tool> = {};
    for (const tool of tools) toolRecord[tool.constructor.name] = tool;

    let base64ImageFile: string | undefined;

    const historyForPrompt = personalHistory.map((turn) => {
      const turnobj: TurnOutput | ToolResult = JSON.parse(JSON.stringify(turn));
      // 画像データの扱いだけ特殊
      if ("tool_name" in turnobj && turnobj.tool_name == "GetImageTool") {
        if (!turnobj.error) {
          if (personalHistory.indexOf(turn) == personalHistory.length - 1) {
            base64ImageFile = turnobj.result;
            turnobj.result = "取得できました。画像データを添付しています。";
          } else {
            turnobj.result =
              "取得できましたが、画像データは1度のみ保持されます。";
          }
        }
        return turnobj;
      }

      // 直近20回の履歴であればファイル内容等もログに含める。
      if (personalHistory.indexOf(turn) > personalHistory.length - 21) {
        return turnobj;
      }

      // それ以前の履歴は省略する
      if ("target_type" in turnobj && turnobj.target_type === "TOOL") {
        const tool_args: { [key: string]: any } = turnobj.tool_args;
        tool_args[turnobj.recipient] = toolRecord[turnobj.recipient].omitArgs(
          tool_args[turnobj.recipient]
        );
        turnobj.tool_args = tool_args;
      }
      if ("tool_name" in turnobj && !turnobj.error)
        turnobj.result = toolRecord[turnobj.tool_name].omitResult(
          turnobj.result
        );
      return turnobj;
    });
    return {
      historyForPrompt: historyForPrompt,
      base64ImageFile: base64ImageFile,
    };
  }

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Tool[],
    team: Agent[]
  ): Promise<TurnOutput> {
    const toolDescriptions = tools.map((v) => ({
      name: v.constructor.name,
      description: v.getDescription(),
    }));

    const teamDescriptions = team.map((v) => v.getOverview());

    const organized = this.organizeHistory(personalHistory, tools);
    let base64ImageFile = organized.base64ImageFile;
    const historyForPrompt = organized.historyForPrompt;

    const prompt = `あなたは自律型開発チームの一員です。
あなたの名前: ${this.name}
プロジェクト内でのあなたの役職: ${this.role}
プロジェクト内でのあなたの役割: ${this.projectRole}
プロジェクトを通してのあなたへの指示・意識すべきこと: ${
      this.detailedInstructions
    }


【タスク】
あなたの役割に基づき、次に行うべきアクションを決定してください。
あなたはプロジェクト全体の会話ログを見ることはできません。判断材料は、あなた自身の過去のやり取りと、現在のファイル状況のみです。
また、あなた自身の過去のやり取りについて、時間が経過した履歴についてはファイル内容やWeb取得内容などを省略します。
折角取得した情報が失われてしまうため、取得した情報は"こまめに"ファイル等にまとめるようにして下さい。

【プロジェクト名】
${project_name}

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【現在のチーム構成】
${JSON.stringify(teamDescriptions, null, 2)}

【あなたの個人的な送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【現在のプロジェクトファイル一覧】
${fileTree}

【行動の選択肢】
1. **他のエージェントと対話する**: \`target_type\`を"AGENT"に設定し、\`recipient\`に対象エージェント名、\`message\`を記述。※特定の一人に対してのみ指示・質問を行い、それを相互に繰り返すことで開発を進めて行きます。並行して指示をしたり、作業を進めたりすることはできません。"ALL"などを使った全員に対しての発言は行わないで下さい。
2. **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
3. **プロジェクト完了**: PMがシステムの製造が完了したと判断した場合のみ、\`special_action\`に"COMPLETE_PROJECT"を設定。
`;
    return this._executeJson(
      prompt,
      getTurnOutputSchemaWithTools(tools),
      base64ImageFile
    );
  }
}
