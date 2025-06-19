import { AIAgent } from "./AIAgent";
import {
  TurnOutput,
  PlanProjectAndKickoff,
  PlanProjectAndKickoffSchema,
  ToolResult,
  getTurnOutputSchemaWithTools,
} from "../models";
import { Logger } from "../core/Logger";
import { Tool } from "../tools/Tool";
import { GoogleGenAI } from "@google/genai";
import { Agent } from "./Agent";

export class PMAgent extends AIAgent {
  constructor(client: GoogleGenAI, name: string, modelName: string) {
    super({
      client: client,
      name: name,
      role: "PM",
      projectRole: `プロジェクトの全体管理と進行、要件定義とチーム編成を行います。また、各作業の最終確認や製造の中で発生した不明点について、ユーザへ確認を行います。`,
      detailedInstructions: `クライアントの要望を満たすシステムを作成するために全力を尽くし、全ての成果物とREADMEなどの手順書を生成するまで作業を全うして下さい。
      製造の中での成果物のレビューを行い、改善すべき点については細かい内容でも積極的に指摘を行ってください。
      ユーザーからの要望や指示が他のエージェントに伝わっていないことがないように常に気を配って下さい。
      また、不明な点があればユーザに確認を行って下さい。`,
      modelName: modelName,
    });
  }

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Tool[],
    team: Agent[]
  ): Promise<TurnOutput> {
    let isDevPhase = false;
    for (const turn of personalHistory) {
      if (
        "special_action" in turn &&
        turn.special_action == "FINALIZE_REQUIREMENTS"
      )
        isDevPhase = true;
    }

    if (isDevPhase) {
      return super.executeTurn(
        personalHistory,
        project_name,
        fileTree,
        tools,
        team
      );
    } else {
      return this._executeRequirementsGathering(
        personalHistory,
        project_name,
        fileTree,
        tools
      );
    }
  }

  private async _executeRequirementsGathering(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Tool[]
  ): Promise<TurnOutput> {
    const toolDescriptions = tools.map((v) => ({
      name: v.constructor.name,
      description: v.getDescription(),
    }));
    const historyForPrompt = personalHistory.map((turn) => ({ ...turn }));
    const prompt = `あなたは優秀なプロジェクトマネージャーです。現在、クライアントと1対1で要件定義を行っています。
あなたは実際にプロジェクトマネージャーとしての業務を行います。
仮想のミーティングの予定を組む、ファイルを作成していないのに確認を求めるなどの開発者を演じる行動は取らないで下さい。
常に実際に必要な行動を取って下さい。

【あなたのタスク】
以下のクライアントとの対話履歴を元に、次のアクションを決定してください。
- **ヒアリング**: 要件が曖昧な点や不足があれば、クライアント（USER）に質問してください。また、システムの要件以外にも、製造フェーズでユーザーに対して質問をする粒度や製造の全体的な流れについても確認を行い、書類を作成するようにして下さい。
- **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
- **要件定義の最終確認**: 要件が十分集まったと判断すれば、要件定義書や画面一覧などユーザがシステムの全容をイメージできるような初期資料をツールを利用して出力し、\`MESSAGE\`で要件定義を完了しても良いか、改善点や他に定義する必要のある内容はないかを確認してください。
- **要件定義の完了**: 要件が十分に集まりユーザが要件定義の完了に同意したら、\`special_action\`に"FINALIZE_REQUIREMENTS"を設定してヒアリングを完了し、初期ドキュメント一式を生成してください。

【プロジェクト名】
${project_name}

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【現在のプロジェクトファイル一覧】
${fileTree}
`;
    return this._executeJson(prompt, getTurnOutputSchemaWithTools(tools));
  }

  async planProjectKickoff(
    logger: Logger,
    team: Agent[]
  ): Promise<PlanProjectAndKickoff> {
    const fullHistory = logger.getFullHistory();
    const historyForPrompt = fullHistory.map((turn) => ({ ...turn }));

    const prompt = `あなたは卓越したPMです。要件定義が完了しました。
対話履歴を確認し、このプロジェクトを遂行するための計画を立ててください。

以下は当チームについての説明です。チームの編成、エージェントへの指示、全体への周知は以下の特性を強く意識して行って下さい。
チームの特性の中で、それぞれのエージェントが意識すべき点はエージェントへの指示に含むようにして下さい。
【チームの特性】
・このチームのメンバはUSERを除いて全員AIで構成されており、人間のチームによる開発とは特性が大きく異なります。仮想のミーティングのスケジュールを組む、実際に行われていないテストについてのテスト結果を報告する、ファイルを作成していないのに確認を求めるなど、このチームの開発に必要のない行動は取らないで下さい。
・このチームのメンバは全員AIで構成されており、システムの本質的な完成を目的としています。人間のシステム開発チームを演じるのではなく、常に実際に必要な行動を取って下さい。
・必要であればPMに確認の上ユーザーに質問・確認を行い、最終的なシステムの完成度が高くなることを目標として下さい。
・常に利用する流れを想定し、製造が進む中で発生した疑問の質問や、機能の追加・修正に関する提案などは積極的に行って下さい。
・また、設計書に利用のフローや利用者のために意識した点なども記載するようにして下さい。

【あなたのタスク】
1. **チーム編成**: プロジェクトに最適な専門家チームを追加し、各々に名前、一般的な役割（role）、プロジェクトでの具体的な役割（project_role）、プロジェクトを通して意識すべきことについての指示（detailed_instructions）を与えてください。現在既に参加しているメンバーの情報は変更しないで下さい。
2. **全体への周知**: チーム全員にプロジェクトの目標を伝える、簡潔な周知メッセージを作成してください。
3. **最初の指示**: チームの中から最初の担当者を一人指名し、具体的な最初のタスクを指示してください。

【現在のチーム構成】
${JSON.stringify(team, null, 2)}

【対話履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【出力形式】
${JSON.stringify(PlanProjectAndKickoffSchema.shape, null, 2)}
`;
    return this._executeJson(prompt, PlanProjectAndKickoffSchema);
  }
}
