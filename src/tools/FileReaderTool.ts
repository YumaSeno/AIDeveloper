import { Tool } from "./Tool";
import { Workspace } from "../core/Workspace";

interface FileReaderArgs {
  filenames: string[];
}

export class FileReaderTool extends Tool {
  readonly name = "file_reader";
  readonly description = "指定された複数のファイルの内容を読み込み、その内容を返します。";
  readonly args_schema = { "filenames": "string[] (読み込むファイルパスのリスト)" };

  async execute(args: FileReaderArgs, workspace: Workspace): Promise<Record<string, string>> {
    if (!Array.isArray(args.filenames)) {
      throw new Error("引数 'filenames' は文字列の配列である必要があります。");
    }
    return workspace.readFiles(args.filenames);
  }
}