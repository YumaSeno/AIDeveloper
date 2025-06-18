import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";

export const FileNameContentSetSchema = z.object({
  filename: z
    .string()
    .describe("パスを含むファイル名(例:docs/要件定義書.md、src/index.html)"),
  contents: z.string().describe("ファイルの内容"),
});
export type FileNameContentSet = z.infer<typeof FileNameContentSetSchema>;

export const FileWriterArgsSchema = z.object({
  artifacts: z
    .array(FileNameContentSetSchema)
    .describe("書き込みたいファイルとその内容の一覧"),
});
export type FileWriterArgs = z.infer<typeof FileWriterArgsSchema>;

export class FileWriterTool extends ToolWithGenerics<string> {
  readonly description =
    "ファイルの内容を書き込みます。複数ファイルに対応しています。";
  readonly args_schema = FileWriterArgsSchema;

  omitArgs(args: ToolArgs): ToolArgs {
    const omitted: ToolArgs = JSON.parse(JSON.stringify(args));
    if (!omitted.FileWriterTool) return omitted;
    omitted.FileWriterTool.artifacts = omitted.FileWriterTool.artifacts.map(
      (t) => ({
        filename: t.filename,
        contents: "（省略）",
      })
    );
    return omitted;
  }

  omitResult(result: string): string {
    return result;
  }

  async execute(args: ToolArgs, workspace: Workspace): Promise<string> {
    if (!args.FileWriterTool) {
      throw new Error("引数 'args' 内に必要なパラメータが設定されていません。");
    }
    if (args.FileWriterTool.artifacts.length <= 0) {
      throw new Error(
        "引数 'args' 内の 'FileWriterTool.artifacts' 内に書き込みたいファイル名と内容のリストを含める必要があります。"
      );
    }
    for (const artifact of args.FileWriterTool.artifacts) {
      await workspace.saveArtifact(artifact.filename, artifact.contents);
    }
    return "ファイルの書き込みが完了しました。";
  }
}
