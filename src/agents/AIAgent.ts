import { GenerateContentConfig, GoogleGenAI } from "@google/genai";
import { ToolResult, TurnOutput, TurnOutputSchema } from "../models";
import { Agent } from "./Agent";
import { Tool } from "../tools/Tool";
import { error } from "console";
import { z } from "zod";
import { toGeminiSchema } from "../core/ZodSchemaConverter";

export class AIAgent extends Agent {
  protected client: GoogleGenAI;
  protected modelName: string;

  constructor(
    client: GoogleGenAI,
    name: string,
    role: string,
    projectRole: string,
    modelName: string
  ) {
    super(name, role, projectRole);
    this.client = client;
    this.modelName = modelName;
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
    const historyForPrompt = personalHistory.map((turn) => ({ ...turn }));

    const prompt = `あなたは自律型開発チームの一員です。
あなたの名前: ${this.name}
あなたの役割: ${this.projectRole || this.role}

あなたはプロジェクト全体の会話ログを見ることはできません。判断材料は、あなた自身の過去のやり取りと、現在のファイル状況のみです。
このチームのメンバはUSERを除いて全員AIで構成されており、人間のチームによる開発とは特性が大きく異なります。
仮想のミーティングのスケジュールを組む、実際に行われていないテストについてのテスト結果を報告する、ファイルを作成していないのに確認を求めるなど、このチームの開発に必要のない行動は取らないで下さい。
特定の一人に対してのみ指示・質問を行い、それを相互に繰り返すことで開発を進めて行きます。並行して指示をしたり、作業を進めたりすることはできません。
"ALL"などで全員に周知を行う言動は行わないで下さい。
繰り返しますが、このチームのメンバは全員AIで構成されており、システムの本質的な完成を目的としています。
人間のシステム開発チームを演じるのではなく、常に実際に必要な行動を取って下さい。
また、必要であればPMに確認の上ユーザーに質問・確認を行い、最終的なシステムの完成度が高くなることを目標として下さい。

【プロジェクト名】
${project_name}

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【現在のチーム構成】
${JSON.stringify(team, null, 2)}

【あなたの個人的な送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【現在のプロジェクトファイル一覧】
${fileTree}

【タスク】あなたの役割に基づき、次に行うべきアクションを決定してください。

【行動の選択肢】
1. **他のエージェントと対話する**: \`target_type\`を"AGENT"に設定し、\`recipient\`に対象エージェント名、\`message\`を記述。
2. **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
3. **プロジェクト完了**: PMがシステムの製造が完了したと判断した場合のみ、\`special_action\`に"COMPLETE_PROJECT"を設定。
`;
    return this._executeJson(prompt, TurnOutputSchema);
  }
}
