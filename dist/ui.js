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
exports.CommandLineUI = void 0;
const readline = __importStar(require("readline/promises"));
const process_1 = require("process");
class CommandLineUI {
    rl;
    constructor() {
        this.rl = readline.createInterface({ input: process_1.stdin, output: process_1.stdout });
    }
    printHeader(text, char = "=") {
        console.log(`\n${char.repeat(60)}\n ${text}\n${char.repeat(60)}`);
    }
    displayMessage(turnObject) {
        const ts = `[${new Date().toLocaleTimeString("ja-JP")}]`;
        if ("tool_name" in turnObject) {
            // ToolResult
            const status = turnObject.error ? "ERROR" : "SUCCESS";
            console.log(`${ts} 🛠️  TOOL EXECUTED: ${turnObject.tool_name} [${status}]\n  Result:`, turnObject.result);
        }
        else if ("recipient" in turnObject) {
            // TurnOutput
            console.log(`${ts} 💬 ${turnObject.sender} -> ${turnObject.recipient} (${turnObject.target_type})`);
            if (turnObject.target_type === "TOOL") {
                console.log(`  ${turnObject.tool_args}`);
            }
            if (turnObject.message) {
                console.log(`  ${turnObject.message}`);
            }
        }
        else {
            console.log(`${ts} ℹ️  System: ${JSON.stringify(turnObject)}`);
        }
        console.log(``);
    }
    async getUserInput(prompt = "") {
        const answer = await this.rl.question(prompt);
        if (prompt == "> ") {
            process.stdout.moveCursor(0, -1);
            process.stdout.clearLine(1);
        }
        return answer;
    }
    displayStatus(message) {
        console.log(message);
    }
    displayError(message) {
        console.error(`❌ エラー: ${message}`);
    }
    close() {
        this.rl.close();
    }
}
exports.CommandLineUI = CommandLineUI;
