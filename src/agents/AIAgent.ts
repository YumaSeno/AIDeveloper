import { GenerateContentConfig, GoogleGenAI } from "@google/genai";
import { ToolResult, TurnOutput, TurnOutputSchema } from "../models";
import { z } from "zod";
import { Agent } from "./Agent";
import { Tool } from "../tools/Tool";
import { toGeminiSchema } from "../core/ZodSchemaConverter";

export class AIAgent extends Agent {
  protected client: GoogleGenAI;
  protected modelName: string;

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
    responseSchema: z.ZodTypeAny
  ): Promise<any> {
    const config: GenerateContentConfig = {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(responseSchema),
    };

    let error_count = 0;
    while (true) {
      try {
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: prompt,
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

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Record<string, Tool>,
    team: Agent[]
  ): Promise<TurnOutput> {
    const toolDescriptions = Object.keys(tools).map((k) => ({
      name: k,
      description: tools[k].getDescription(),
    }));
    // ファイルの内容・Webページの内容などを除いたメッセージ履歴
    const historyForPrompt = personalHistory.map((turn) => {
      // 直近10回の履歴であればファイル内容等もログに含める。
      if (personalHistory.indexOf(turn) > personalHistory.length - 11)
        return turn;
      const turnobj: TurnOutput | ToolResult = JSON.parse(JSON.stringify(turn));
      if ("target_type" in turnobj && turnobj.target_type === "TOOL") {
        turnobj.tool_args = tools[turnobj.recipient].omitArgs(
          turnobj.tool_args
        );
      }
      if ("tool_name" in turnobj)
        turnobj.result = tools[turnobj.tool_name].omitResult(turnobj.result);
      return turnobj;
    });

    const prompt = `あなたは自律型開発チームの一員です。
あなたの名前: ${this.name}
プロジェクト内でのあなたの役職: ${this.role}
プロジェクト内でのあなたの役割: ${this.projectRole}
プロジェクトを通してのあなたへの指示・意識すべきこと: ${
      this.detailedInstructions
    }


【タスク】
あなたの役割に基づき、次に行うべきアクションを決定してください。
また、あなたはプロジェクト全体の会話ログを見ることはできません。判断材料は、あなた自身の過去のやり取りと、現在のファイル状況のみです。

【プロジェクト名】
${project_name}

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【現在のチーム構成】
${JSON.stringify(team, null, 2)}

【あなたの個人的な送受信メッセージ履歴】（直近10回より前の履歴についてはファイル内容やWeb取得内容などを省略しています。必要であれば再取得して下さい。）
${JSON.stringify(historyForPrompt, null, 2)}

【現在のプロジェクトファイル一覧】
${fileTree}

【行動の選択肢】
1. **他のエージェントと対話する**: \`target_type\`を"AGENT"に設定し、\`recipient\`に対象エージェント名、\`message\`を記述。※特定の一人に対してのみ指示・質問を行い、それを相互に繰り返すことで開発を進めて行きます。並行して指示をしたり、作業を進めたりすることはできません。"ALL"などを使った全員に対しての発言は行わないで下さい。
2. **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
3. **プロジェクト完了**: PMがシステムの製造が完了したと判断した場合のみ、\`special_action\`に"COMPLETE_PROJECT"を設定。
`;
    return this._executeJson(prompt, TurnOutputSchema);
  }
}
