import { Tool } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";

export const ShellCommandToolArgsSchema = z.object({
  command: z.string().describe("実行したいシェルコマンド"),
});
export type ShellCommandToolArgs = z.infer<typeof ShellCommandToolArgsSchema>;

export class ShellCommandTool extends Tool {
  readonly description =
    "シェルコマンドを実行します。コマンドはコンテナ内で実行され、osはDebianです。ルートフォルダ直下の/workspace/[プロジェクト名]にファイルが配置されます。";
  readonly args_schema = ShellCommandToolArgsSchema;

  async execute(args: ToolArgs, workspace: Workspace): Promise<any> {
    // if (!args.ShellCommandTool) {
    //   throw new Error("引数 'args' 内に必要なパラメータが設定されていません。");
    // }
    // if (!Array.isArray(args.ShellCommandTool.filenames)) {
    //   throw new Error(
    //     "引数 'args' 内の 'ShellCommandTool.command' 内に実行したいシェルコマンドを含める必要があります。"
    //   );
    // }
    // TODO: 初回にコンテナを作成・起動する。コマンドを実行する
    return;
  }
}
