import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import { Orchestrator } from "./orchestrator";
import { CommandLineUI } from "./ui";
import { FileReaderTool } from "./tools/FileReaderTool";
import { Workspace } from "./core/Workspace";
import { FileWriterTool } from "./tools/FileWriterTool";
import { WebSearchTool } from "./tools/WebSearchTool";
import { GetHttpContentsTool } from "./tools/GetHttpContentsTool";

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

  try {
    while (true) {
      const mode = await ui.getUserInput(
        "新しいプロジェクトを開始しますか、既存のプロジェクトを再開しますか？ (new/resume): "
      );
      if (
        mode.trim().toLowerCase() !== "resume" &&
        mode.trim().toLowerCase() !== "new"
      )
        continue;

      const isResume = mode.trim().toLowerCase() === "resume";
      const projectName = await ui.getUserInput(
        isResume
          ? "新しいプロジェクト名を入力: "
          : "再開するプロジェクト名を入力: "
      );
      const workspace = new Workspace(projectName);
      const orchestrator = new Orchestrator(ui, [
        new FileReaderTool(workspace),
        new FileWriterTool(workspace),
        new WebSearchTool(),
        new GetHttpContentsTool(client, model_name),
      ]);
      const initialSpeaker = await orchestrator.setupProject(
        projectName,
        workspace,
        client,
        model_name,
        isResume
      );
      await orchestrator.run(client, initialSpeaker, model_name);
      break;
    }
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
