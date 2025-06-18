import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";
import axios from "axios";

export const GetHttpContentsToolArgsSchema = z.object({
  url: z
    .string()
    .describe("取得したいhttpリクエスト先のアドレス(例:https://google.com)"),
});
export type GetHttpContentsToolArgs = z.infer<
  typeof GetHttpContentsToolArgsSchema
>;

export class GetHttpContentsTool extends ToolWithGenerics<string> {
  readonly description =
    "キーワードに関連するウェブページの名前とアドレスを取得します。ページの情報を詳しく閲覧したい場合はGetHttpContentsToolを利用して下さい。";
  readonly args_schema = GetHttpContentsToolArgsSchema;

  omitArgs(args: ToolArgs): ToolArgs {
    return args;
  }

  omitResult(result: string): string {
    return "（省略）";
  }

  async execute(args: ToolArgs, workspace: Workspace): Promise<string> {
    if (!args.GetHttpContentsTool) {
      throw new Error("引数 'args' 内に必要なパラメータが設定されていません。");
    }
    if (
      args.GetHttpContentsTool.url == null ||
      args.GetHttpContentsTool.url === ""
    ) {
      throw new Error("args.GetHttpContentsTool.queryが空になっています。");
    }
    const url = args.GetHttpContentsTool.url;
    const response = await axios.get(url, {
      headers: {
        // 一部のサイトではUser-Agentがないとアクセスを弾かれる場合があるため指定
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      },
    });

    await new Promise((res) => setTimeout(res, 5000)); // 連続でリクエストを送るとコンピュータであると認識される可能性があるため。

    const html = response.data;
    return html;
  }
}
