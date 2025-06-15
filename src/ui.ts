import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { ToolResult, TurnOutput } from "./models";

export class CommandLineUI {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({ input, output });
  }

  printHeader(text: string, char = "="): void {
    console.log(`\n${char.repeat(60)}\n ${text}\n${char.repeat(60)}`);
  }

  displayMessage(turnObject: TurnOutput | ToolResult): void {
    const ts = `[${new Date().toLocaleTimeString("ja-JP")}]`;
    if ("tool_name" in turnObject) {
      // ToolResult
      const status = turnObject.error ? "ERROR" : "SUCCESS";
      console.log(
        `${ts} 🛠️  TOOL EXECUTED: ${turnObject.tool_name} [${status}]\n  Result:`,
        turnObject.result
      );
    } else if ("recipient" in turnObject) {
      // TurnOutput
      const thought = turnObject.thought
        ? `\n  🤔 Thought: ${turnObject.thought}`
        : "";
      console.log(
        `${ts} 💬 ${turnObject.sender} -> ${turnObject.recipient}:${thought}`
      );
      if (turnObject.message) {
        console.log(`  ${turnObject.message}`);
      }
    } else {
      console.log(`${ts} ℹ️  System: ${JSON.stringify(turnObject)}`);
    }
  }

  async getUserInput(prompt = ""): Promise<string> {
    return this.rl.question(prompt);
  }

  displayStatus(message: string): void {
    console.log(message);
  }

  displayError(message: string): void {
    console.error(`❌ エラー: ${message}`);
  }

  close(): void {
    this.rl.close();
  }
}
