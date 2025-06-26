import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";

const FileNameContentSetSchema = z.object({
  filename: z
    .string()
    .describe(
      "書き込みたいファイルの相対パスを含むファイル名(例:docs/要件定義書.md、src/index.html) ※絶対パスは指定しないで下さい。"
    ),
  contents: z.string().describe("ファイルの内容"),
});
type FileNameContentSet = z.infer<typeof FileNameContentSetSchema>;

const FileWriterArgsSchema = z.object({
  artifacts: z
    .array(FileNameContentSetSchema)
    .describe("書き込みたいファイルとその内容の一覧"),
});
type FileWriterArgs = z.infer<typeof FileWriterArgsSchema>;

const FileWriterReturnSchema = z.string().describe("書き込み結果");
type FileWriterReturn = z.infer<typeof FileWriterReturnSchema>;

export class FileWriterTool extends ToolWithGenerics<
  FileWriterArgs,
  FileWriterReturn
> {
  protected readonly workspace: Workspace;

  constructor(workspace: Workspace) {
    super({
      description:
        "ファイルの内容を書き込みます。複数ファイルに対応しています。",
      argsSchema: FileWriterArgsSchema,
      returnSchema: FileWriterReturnSchema,
    });
    this.workspace = workspace;
  }

  omitArgs(passedTurns: number, args: FileWriterArgs): FileWriterArgs {
    if (passedTurns < 5) return args;
    const omitted: FileWriterArgs = JSON.parse(JSON.stringify(args));
    omitted.artifacts = omitted.artifacts.map((t) => ({
      filename: t.filename,
      contents: "（省略）",
    }));
    return omitted;
  }

  omitResult(passedTurns: number, result: string): string {
    return result;
  }

  protected async _executeTool(args: FileWriterArgs): Promise<string> {
    if (args.artifacts.length <= 0) {
      throw new Error(
        "引数 'args' 内の 'FileWriterTool.artifacts' 内に書き込みたいファイル名と内容のリストを含める必要があります。"
      );
    }
    for (const artifact of args.artifacts) {
      await this.workspace.saveArtifact(artifact.filename, artifact.contents);
    }
    return "ファイルの書き込みが完了しました。";
  }
}
