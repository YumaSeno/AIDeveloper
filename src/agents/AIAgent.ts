import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { ToolResult, TurnOutput, TurnOutputSchema } from "../models";
import { Agent } from "./Agent";
import { Tool } from "../tools/Tool";

export class AIAgent extends Agent {
  protected client: GoogleGenerativeAI;
  protected model: GenerativeModel;

  constructor(
    client: GoogleGenerativeAI,
    name: string,
    role: string,
    projectRole: string,
    modelName: string
  ) {
    super(name, role, projectRole);
    this.client = client;
    this.model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
  }

  protected async _executeJson(
    prompt: string,
    responseSchema: any
  ): Promise<any> {
    // Zod スキーマをGoogleのJSONスキーマ形式に変換
    const generationConfig = {
      responseSchema: {
        type: "object",
        properties: responseSchema.shape,
      },
    };

    while (true) {
      try {
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        });

        const text = result.response.text();
        const parsed = JSON.parse(text);
        return responseSchema.parse(parsed); // Zodで検証
      } catch (e) {
        console.warn(
          `警告: API呼び出し中にエラーが発生しました: ${e}。30秒待機してリトライします。`
        );
        await new Promise((res) => setTimeout(res, 30000));
      }
    }
  }

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    fileTree: string,
    tools: Record<string, Tool>
  ): Promise<TurnOutput> {
    const toolDescriptions = Object.values(tools).map((t) =>
      t.getDescriptionDict()
    );
    const historyForPrompt = personalHistory.map((turn) => ({ ...turn }));

    const prompt = `あなたは自律型開発チームの一員です。
あなたの名前: ${this.name}
あなたの役割: ${this.projectRole || this.role}

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【あなたの個人的な送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【現在のプロジェクトファイル一覧】
${fileTree}

【タスク】あなたの役割に基づき、次に行うべきアクションを決定してください。

【行動の選択肢】
1. **他のエージェントと対話する**: \`target_type\`を"AGENT"に設定し、\`recipient\`に対象エージェント名、\`message\`を記述。
2. **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
3. **プロジェクト完了**: PMがシステムの製造が完了したと判断した場合のみ、\`special_action\`に"COMPLETE_PROJECT"を設定。

【出力形式】
必ずJSON形式で、以下のスキーマに従って出力してください。
${JSON.stringify(TurnOutputSchema.shape, null, 2)}
`;
    return this._executeJson(prompt, TurnOutputSchema);
  }
}
