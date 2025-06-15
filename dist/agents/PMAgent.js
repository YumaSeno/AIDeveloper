"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PMAgent = void 0;
const AIAgent_1 = require("./AIAgent");
const models_1 = require("../models");
class PMAgent extends AIAgent_1.AIAgent {
    constructor(client, name, modelName) {
        super(client, name, "PM", `プロジェクトの全体管理と進行、要件定義とチーム編成を行います。
      PMはクライアントの要望を満たすシステムを作成するために全力を尽くし、全ての成果物とREADMEなどの手順書を生成するまで作業を全うします。
      製造の中での成果物のレビューを行い、改善すべき点については細かい内容でも積極的に指摘を行います。
      また、不明点があればPMを通してユーザに確認を行います。`, modelName);
    }
    async executeTurn(personalHistory, fileTree, tools, team) {
        let isDevPhase = false;
        for (const turn of personalHistory) {
            if ("special_action" in turn &&
                turn.special_action == "FINALIZE_REQUIREMENTS")
                isDevPhase = true;
        }
        if (isDevPhase) {
            return super.executeTurn(personalHistory, fileTree, tools, team);
        }
        else {
            return this._executeRequirementsGathering(personalHistory, tools);
        }
    }
    async _executeRequirementsGathering(personalHistory, tools) {
        const toolDescriptions = Object.keys(tools).map((k) => ({
            name: k,
            description: tools[k].getDescriptionDict(),
        }));
        const historyForPrompt = personalHistory.map((turn) => ({ ...turn }));
        const prompt = `あなたは優秀なプロジェクトマネージャーです。現在、クライアントと1対1で要件定義を行っています。

【あなたのタスク】
以下のクライアントとの対話履歴を元に、次のアクションを決定してください。
- **ヒアリング**: 要件が曖昧な点や不足があれば、クライアント（USER）に質問してください。
- **ツールを利用する**: \`target_type\`を"TOOL"に設定し、\`recipient\`に対象ツール名、\`tool_args\`を記述。
- **要件定義の最終確認**: 要件が十分集まったと判断すれば、要件定義書や画面一覧などユーザがシステムの全容をイメージできるような初期資料を出力し、\`MESSAGE\`で要件定義を完了しても良いか、改善点や他に定義する必要のある内容はないかを確認してください。
- **要件定義の完了**: 要件が十分に集まりユーザが要件定義の完了に同意したら、\`special_action\`に"FINALIZE_REQUIREMENTS"を設定してヒアリングを完了し、初期ドキュメント一式を生成してください。

【利用可能なツール一覧】
${JSON.stringify(toolDescriptions, null, 2)}

【送受信メッセージ履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【出力形式】
${JSON.stringify(models_1.TurnOutputSchema.shape, null, 2)}
`;
        return this._executeJson(prompt, models_1.TurnOutputSchema);
    }
    async planProjectKickoff(logger, team) {
        const fullHistory = logger.getFullHistory();
        const historyForPrompt = fullHistory.map((turn) => ({ ...turn }));
        const prompt = `あなたは卓越したPMです。要件定義が完了しました。
以下の対話履歴全体をレビューし、このプロジェクトを遂行するための計画を立ててください。

【あなたのタスク】
1. **チーム編成**: プロジェクトに最適な専門家チームを追加し、各々に名前、一般的な役割（role）、**プロジェクトでの具体的な役割（project_role）**を与えてください。現在既に参加しているメンバーの情報は変更しないで下さい。
2. **全体への周知**: チーム全員にプロジェクトの目標を伝える、簡潔な周知メッセージを作成してください。
3. **最初の指示**: チームの中から最初の担当者を一人指名し、具体的な最初のタスクを指示してください。

【現在のチーム構成】
${JSON.stringify(team, null, 2)}

【対話履歴】
${JSON.stringify(historyForPrompt, null, 2)}

【出力形式】
${JSON.stringify(models_1.PlanProjectAndKickoffSchema.shape, null, 2)}
`;
        return this._executeJson(prompt, models_1.PlanProjectAndKickoffSchema);
    }
}
exports.PMAgent = PMAgent;
