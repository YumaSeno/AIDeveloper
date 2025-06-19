import { ToolWithGenerics } from "./Tool";
import { z } from "zod";

export const ShellCommandToolArgsSchema = z.object({
  command: z.string().describe("実行したいシェルコマンド"),
});
export type ShellCommandToolArgs = z.infer<typeof ShellCommandToolArgsSchema>;

export const ShellCommandToolReturnSchema = z.any();
export type ShellCommandToolReturn = z.infer<
  typeof ShellCommandToolReturnSchema
>;

export class ShellCommandTool extends ToolWithGenerics<
  ShellCommandToolArgs,
  ShellCommandToolReturn
> {
  constructor() {
    super({
      description:
        "シェルコマンドを実行します。コマンドはコンテナ内で実行され、osはDebianです。ルートフォルダ直下の/workspace/[プロジェクト名]にファイルが配置されます。",
      argsSchema: ShellCommandToolArgsSchema,
      returnSchema: ShellCommandToolReturnSchema,
    });
  }

  omitArgs(args: ShellCommandToolArgs): ShellCommandToolArgs {
    return args;
  }

  omitResult(result: ShellCommandToolReturn): ShellCommandToolReturn {
    return result;
  }

  async _executeTool(
    args: ShellCommandToolArgs
  ): Promise<ShellCommandToolReturn> {
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
