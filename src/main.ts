import { GoogleGenAI } from "@google/genai";
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

  const client = new GoogleGenAI({ apiKey: apiKey });
  const ui = new CommandLineUI();
  const orchestrator = new Orchestrator(ui);

  try {
    let initialSpeaker: string | undefined = undefined;
    while (!initialSpeaker) {
      const mode = await ui.getUserInput(
        "新しいプロジェクトを開始しますか、既存のプロジェクトを再開しますか？ (new/resume): "
      );
      if (mode.trim().toLowerCase() === "resume") {
        initialSpeaker = await orchestrator.setupResumeProject(
          client,
          model_name
        );
      } else if (mode.trim().toLowerCase() === "new") {
        initialSpeaker = await orchestrator.setupNewProject(client, model_name);
      }
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
