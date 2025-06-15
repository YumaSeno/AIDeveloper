import * as fs from "fs/promises";
import * as path from "path";
import {
  TurnOutput,
  ToolResult,
  TurnOutputSchema,
  ToolResultSchema,
} from "../models";

export class Logger {
  private readonly logFilePath: string;
  private inMemoryLog: (TurnOutput | ToolResult)[] = [];

  constructor(logDir: string, mode: "w" | "a" = "w") {
    this.logFilePath = path.join(logDir, "00_Project_Log.jsonl");
    if (mode === "w") {
      // ファイルを空にする
      fs.writeFile(this.logFilePath, "").catch((e) => {
        throw new Error(`ログファイルの初期化に失敗しました: ${e}`);
      });
    }
  }

  async log(turnObject: TurnOutput | ToolResult): Promise<void> {
    this.inMemoryLog.push(turnObject);
    const logType = turnObject.sender === "System" ? "tool_result" : "turn";
    const logEntry = { log_type: logType, data: turnObject };
    const line = JSON.stringify(logEntry) + "\n";
    await fs.appendFile(this.logFilePath, line, "utf-8");
  }

  async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.logFilePath, "utf-8");
      const lines = data.split("\n").filter((line) => line.trim() !== "");
      this.inMemoryLog = lines
        .map((line) => {
          try {
            const logEntry = JSON.parse(line);
            const logType = logEntry.log_type;
            const data = logEntry.data;
            if (logType === "turn") {
              return TurnOutputSchema.parse(data);
            } else if (logType === "tool_result") {
              return ToolResultSchema.parse(data);
            }
          } catch (e) {
            console.warn(
              `警告: ログファイルの行のパースに失敗しました: ${line}`,
              e
            );
            return null;
          }
        })
        .filter((item): item is TurnOutput | ToolResult => item !== null);
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        // ファイルが存在しない場合は何もしない
      } else {
        throw new Error(`ログファイルの読み込みに失敗しました: ${e}`);
      }
    }
  }

  getFullHistory(): (TurnOutput | ToolResult)[] {
    return this.inMemoryLog;
  }

  getPersonalHistory(agentName: string): (TurnOutput | ToolResult)[] {
    const personalHistory: (TurnOutput | ToolResult)[] = [];
    let lastTurnSender: string | null = null;
    for (const turn of this.inMemoryLog) {
      if ("recipient" in turn) {
        // TurnOutput
        if (
          turn.recipient === agentName ||
          turn.sender === agentName ||
          turn.recipient === "ALL"
        ) {
          personalHistory.push(turn);
        }
        lastTurnSender = turn.sender;
      } else {
        // ToolResult
        if (lastTurnSender === agentName) {
          personalHistory.push(turn);
        }
      }
    }
    return personalHistory;
  }

  getLastTurn(): TurnOutput | ToolResult | undefined {
    return this.inMemoryLog.length > 0
      ? this.inMemoryLog[this.inMemoryLog.length - 1]
      : undefined;
  }
}
