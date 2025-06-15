"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const models_1 = require("../models");
class Logger {
    logFilePath;
    inMemoryLog = [];
    constructor(logDir, mode = "w") {
        this.logFilePath = path.join(logDir, "00_Project_Log.jsonl");
        if (mode === "w") {
            // ファイルを空にする
            fs.writeFile(this.logFilePath, "").catch((e) => {
                throw new Error(`ログファイルの初期化に失敗しました: ${e}`);
            });
        }
    }
    async log(turnObject) {
        this.inMemoryLog.push(turnObject);
        const logType = "recipient" in turnObject ? "turn" : "tool_result";
        const logEntry = { log_type: logType, data: turnObject };
        const line = JSON.stringify(logEntry) + "\n";
        await fs.appendFile(this.logFilePath, line, "utf-8");
    }
    async loadFromFile() {
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
                        return models_1.TurnOutputSchema.parse(data);
                    }
                    else if (logType === "tool_result") {
                        return models_1.ToolResultSchema.parse(data);
                    }
                }
                catch (e) {
                    console.warn(`警告: ログファイルの行のパースに失敗しました: ${line}`, e);
                    return null;
                }
            })
                .filter((item) => item !== null);
        }
        catch (e) {
            if (e instanceof Error && "code" in e && e.code === "ENOENT") {
                // ファイルが存在しない場合は何もしない
            }
            else {
                throw new Error(`ログファイルの読み込みに失敗しました: ${e}`);
            }
        }
    }
    getFullHistory() {
        return this.inMemoryLog;
    }
    getPersonalHistory(agentName) {
        const personalHistory = [];
        let lastTurnSender = null;
        for (const turn of this.inMemoryLog) {
            if ("recipient" in turn) {
                // TurnOutput
                if (turn.recipient === agentName ||
                    turn.sender === agentName ||
                    turn.recipient === "ALL") {
                    personalHistory.push(turn);
                }
                lastTurnSender = turn.sender;
            }
            else {
                // ToolResult
                if (lastTurnSender === agentName) {
                    personalHistory.push(turn);
                }
            }
        }
        return personalHistory;
    }
    getLastTurn() {
        return this.inMemoryLog.length > 0
            ? this.inMemoryLog[this.inMemoryLog.length - 1]
            : undefined;
    }
}
exports.Logger = Logger;
