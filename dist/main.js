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
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
const orchestrator_1 = require("./orchestrator");
const ui_1 = require("./ui");
async function main() {
    dotenv.config();
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("❌ APIキーが見つかりません。`.env`ファイルを確認してください。");
        return;
    }
    const model_name = process.env.GEMINI_MODEL;
    if (!model_name) {
        console.error("❌ モデル名が見つかりません。`.env`ファイルを確認してください。");
        return;
    }
    const client = new genai_1.GoogleGenAI({ apiKey: apiKey });
    const ui = new ui_1.CommandLineUI();
    const orchestrator = new orchestrator_1.Orchestrator(ui);
    try {
        const mode = await ui.getUserInput("新しいプロジェクトを開始しますか、既存のプロジェクトを再開しますか？ (new/resume): ");
        let initialSpeaker;
        if (mode.toLowerCase() === "resume") {
            initialSpeaker = await orchestrator.setupResumeProject(client, model_name);
        }
        else {
            initialSpeaker = await orchestrator.setupNewProject(client, model_name);
        }
        await orchestrator.run(client, initialSpeaker, model_name);
    }
    catch (e) {
        if (e instanceof Error) {
            ui.displayError(`予期せぬエラーが発生しました: ${e.message}`);
            console.error(e.stack);
        }
    }
    finally {
        ui.close();
        console.log("\nプログラムを終了しました。");
    }
}
main();
