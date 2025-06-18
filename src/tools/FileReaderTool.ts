import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";

export const FileReaderArgsSchema = z.object({
  filenames: z.array(z.string()).describe("読み込みたいファイルの一覧"),
});
export type FileReaderArgs = z.infer<typeof FileReaderArgsSchema>;

export class FileReaderTool extends ToolWithGenerics<Record<string, string>> {
  readonly description =
    "指定された複数のファイルの内容を読み込み、その内容を返します。";
  readonly args_schema = FileReaderArgsSchema;

  omitArgs(args: ToolArgs): ToolArgs {
    return args;
  }

  omitResult(result: Record<string, string>): Record<string, string> {
    const omitted: Record<string, string> = { ...result };
    for (const key in omitted) {
      omitted[key] = "(省略)";
    }
    return omitted;
  }

  async execute(
    args: ToolArgs,
    workspace: Workspace
  ): Promise<Record<string, string>> {
    if (!args.FileReaderTool) {
      throw new Error("引数 'args' 内に必要なパラメータが設定されていません。");
    }
    if (!Array.isArray(args.FileReaderTool.filenames)) {
      throw new Error(
        "引数 'args' 内の 'FileReaderTool.filenames' 内に取得したいファイル名のリストを含める必要があります。"
      );
    }
    return workspace.readFiles(args.FileReaderTool.filenames);
  }
}
