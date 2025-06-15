"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAgent = void 0;
const Agent_1 = require("./Agent");
class UserAgent extends Agent_1.Agent {
    ui;
    constructor(name, ui) {
        super(name, "クライアント", `クライアントを表すエージェントです。要件の聞き取りの対象者です。
      また、製造を進める中で出てきた、仕様について不明な点や検討すべき内容の質問を受け付けます。`);
        this.ui = ui;
    }
    async executeTurn(personalHistory, fileTree, tools, team) {
        const lastTurn = personalHistory.length > 0
            ? personalHistory[personalHistory.length - 1]
            : null;
        const recipient = lastTurn && "sender" in lastTurn ? lastTurn.sender : "PM";
        const userInput = await this.ui.getUserInput("> ");
        return {
            target_type: "AGENT",
            recipient: recipient,
            message: userInput,
            thought: "（ユーザーの思考は直接入力された）",
            sender: this.name,
            tool_args: {},
            special_action: "_",
        };
    }
}
exports.UserAgent = UserAgent;
