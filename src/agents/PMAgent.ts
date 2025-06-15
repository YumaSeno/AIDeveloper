import { AIAgent } from "./AIAgent";
import {
  TurnOutput,
  TurnOutputSchema,
  PlanProjectAndKickoff,
  PlanProjectAndKickoffSchema,
  ToolResult,
} from "../models";
import { Logger } from "../core/Logger";
import { Tool } from "../tools/Tool";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class PMAgent extends AIAgent {
  constructor(client: GoogleGenerativeAI, name: string, modelName: string) {
    super(
      client,
      name,
      "PM",
      `プロジェクトの全体管理と進行、要件定義とチーム編成を行います。
      PMはクライアントの要望を満たすシステムを作成するために全力を尽くし、全ての成果物とREADMEなどの手順書を生成するまで作業を全うします。
      製造の中での成果物のレビューを行い、改善すべき点については細かい内容でも積極的に指摘を行います。
      また、不明点があればPMを通してユーザに確認を行います。`,
      modelName
    );
  }

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    fileTree: string,
    tools: Record<string, Tool>
  ): Promise<TurnOutput> {
    const isDevPhase = personalHistory.some(
      (turn) =>
        "sender" in turn && !["PM", "USER", "System"].includes(turn.sender)
    );

    if (isDevPhase) {
      return super.executeTurn(personalHistory, fileTree, tools);
    } else {
      return this._executeRequirementsGathering(personalHistory);
    }
  }

  private async _executeRequirementsGathering(
    personalHistory: (TurnOutput | ToolResult)[]
  ): Promise<TurnOutput> {
    const historyForPrompt = personalHistory.map((turn) => ({ ...turn }));
    const prompt = `あなたは優秀なプロジェクトマネージャーです。現在、クライアントと1対1で要件定義を行っています。

【あなたのタスク】
以下のクライアントとの対話履歴を元に、次のアクションを決定してください。
- **ヒアリング**: 要件が曖昧な点や不足があれば、クライアント（USER）に質問してください。
- **要件定義の完了**: 要件が十分集まったと判断すれば、\`special_action\`に"FINALIZE_REQUIREMENTS"を設定して、ヒアリングを完了してください。

【送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【出力形式】
${JSON.stringify(TurnOutputSchema.shape, null, 2)}
`;
    return this._executeJson(prompt, TurnOutputSchema);
  }

  async planProjectKickoff(logger: Logger): Promise<PlanProjectAndKickoff> {
    const fullHistory = logger.getFullHistory();
    const historyForPrompt = fullHistory.map((turn) => ({ ...turn }));

    const prompt = `あなたは卓越したPMです。要件定義が完了しました。
以下の対話履歴全体をレビューし、このプロジェクトを遂行するための計画を立ててください。

【あなたのタスク】
1. **チーム編成**: プロジェクトに最適な専門家チームを追加し、各々に名前、一般的な役割（role）、**プロジェクトでの具体的な役割（project_role）**を与えてください。
2. **全体への周知**: チーム全員にプロジェクトの目標を伝える、簡潔な周知メッセージを作成してください。
3. **最初の指示**: チームの中から最初の担当者を一人指名し、具体的な最初のタスクを指示してください。

【対話履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【出力形式】
${JSON.stringify(PlanProjectAndKickoffSchema.shape, null, 2)}
`;
    return this._executeJson(prompt, PlanProjectAndKickoffSchema);
  }
}
