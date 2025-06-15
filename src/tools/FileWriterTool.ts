import { Tool } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";

export const FileNameContentSetSchema = z.object({
  filename: z.string().describe("パスを含むファイル名(例:docs/要件定義書.md)"),
  contents: z.string().describe("ファイルの内容"),
});
export type FileNameContentSet = z.infer<typeof FileNameContentSetSchema>;

export const FileWriterArgsSchema = z.object({
  artifacts: z
    .array(FileNameContentSetSchema)
    .describe("書き込みたいファイルとその内容の一覧"),
});
export type FileWriterArgs = z.infer<typeof FileWriterArgsSchema>;

export class FileWriterTool extends Tool {
  readonly description =
    "指定された複数のファイルの内容を読み込み、その内容を返します。";
  readonly args_schema = {
    filenames: "string[] (読み込むファイルパスのリスト)",
  };

  async execute(args: ToolArgs, workspace: Workspace): Promise<string> {
    if (!args.FileWriterTool) {
      throw new Error("引数 'args' 内のFileWriterToolが設定されていません。");
    }
    if (!Array.isArray(args.FileWriterTool.artifacts)) {
      throw new Error(
        "引数 'args' 内の 'FileWriterTool.filenames' 内に取得したいファイル名のリストを含める必要があります。"
      );
    }
    for (const artifact of args.FileWriterTool.artifacts) {
      await workspace.saveArtifact(artifact.filename, artifact.contents);
    }
    return "ファイルの書き込みが完了しました。";
  }
}
