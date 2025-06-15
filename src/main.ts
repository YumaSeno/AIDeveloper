import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { Orchestrator } from "./orchestrator";
import { CommandLineUI } from "./ui";

async function main() {
  dotenv.config();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ APIキーが見つかりません。`.env`ファイルを確認してください。"
    );
    return;
  }
  const model_name = process.env.GEMINI_MODEL;
  if (!model_name) {
    console.error(
      "❌ モデル名が見つかりません。`.env`ファイルを確認してください。"
    );
    return;
  }

  const client = new GoogleGenerativeAI(apiKey);
  const ui = new CommandLineUI();
  const orchestrator = new Orchestrator(ui);

  try {
    const mode = await ui.getUserInput(
      "新しいプロジェクトを開始しますか、既存のプロジェクトを再開しますか？ (new/resume): "
    );
    let initialSpeaker: string;
    if (mode.toLowerCase() === "resume") {
      initialSpeaker = await orchestrator.setupResumeProject(
        client,
        model_name
      );
    } else {
      initialSpeaker = await orchestrator.setupNewProject(client, model_name);
    }
    await orchestrator.run(client, initialSpeaker, model_name);
  } catch (e) {
    if (e instanceof Error) {
      ui.displayError(`予期せぬエラーが発生しました: ${e.message}`);
      console.error(e.stack);
    }
  } finally {
    ui.close();
    console.log("\nプログラムを終了しました。");
  }
}

main();
