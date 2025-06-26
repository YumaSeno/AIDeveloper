import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";

const FileReaderArgsSchema = z.object({
  filenames: z.array(
    z
      .string()
      .describe(
        "読み込みたいファイルの相対パスを含むファイル名(例:docs/要件定義書.md、src/index.html) ※絶対パスは指定しないで下さい。"
      )
  ),
});
type FileReaderArgs = z.infer<typeof FileReaderArgsSchema>;

const FileReaderReturnSchema = z.record(
  z.string().describe("ファイル名"),
  z.string().describe("ファイルの内容")
);
type FileReaderReturn = z.infer<typeof FileReaderReturnSchema>;

export class FileReaderTool extends ToolWithGenerics<
  FileReaderArgs,
  FileReaderReturn
> {
  protected readonly workspace: Workspace;

  constructor(workspace: Workspace) {
    super({
      description:
        "指定された複数のファイルの内容を読み込み、その内容を返します。",
      argsSchema: FileReaderArgsSchema,
      returnSchema: FileReaderReturnSchema,
    });
    this.workspace = workspace;
  }

  omitArgs(passedTurns: number, args: FileReaderArgs): FileReaderArgs {
    return args;
  }

  omitResult(passedTurns: number, result: FileReaderReturn): FileReaderReturn {
    if (passedTurns < 5) return result;
    const omitted: FileReaderReturn = { ...result };
    for (const key in omitted) {
      omitted[key] = "(省略)";
    }
    return omitted;
  }

  protected async _executeTool(
    args: FileReaderArgs
  ): Promise<FileReaderReturn> {
    if (!Array.isArray(args.filenames)) {
      throw new Error(
        "引数 'args' 内の 'FileReaderTool.filenames' 内に取得したいファイル名のリストを含める必要があります。"
      );
    }
    return this.workspace.readFiles(args.filenames);
  }
}
