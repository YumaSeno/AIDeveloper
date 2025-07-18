import { ToolResult, TurnOutput } from "../models";
import { Agent } from "./Agent";
import { Tool } from "../tools/Tool";
import { CommandLineUI } from "../ui";

export class UserAgent extends Agent {
  private ui: CommandLineUI;

  constructor(name: string, ui: CommandLineUI) {
    super({
      name: name,
      role: "クライアント",
      projectRole: `クライアントを表すエージェントです。要件の聞き取りの対象者です。
      また、製造を進める中で出てきた、仕様について不明な点や検討すべき内容の質問を受け付けます。`,
      detailedInstructions: ``,
    });
    this.ui = ui;
  }

  async executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Tool[],
    team: Agent[]
  ): Promise<TurnOutput> {
    const lastTurn =
      personalHistory.length > 0
        ? personalHistory[personalHistory.length - 1]
        : null;
    const recipient = lastTurn && "sender" in lastTurn ? lastTurn.sender : "PM";

    const userInput = await this.ui.getUserInput("> ");

    return {
      target_type: "AGENT",
      recipient: recipient,
      message: userInput,
      sender: this.name,
      tool_args: {},
      special_action: "_",
    };
  }
}
