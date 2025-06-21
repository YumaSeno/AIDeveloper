import { ToolWithGenerics } from "./Tool";
import { z } from "zod";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

const GetHttpContentsToolArgsSchema = z.object({
  summarize: z
    .boolean()
    .default(true)
    .describe(
      "取得した内容の文章化を行うかどうか。HTMLタグなどの不必要な情報を除き文章量を削減するため、jsやcssなどのコード自体を取得したい場合を除き基本的にはtrueとして下さい。"
    ),
  summary_instructions: z
    .string()
    .describe(
      "文章化についての指示。(例:〇〇株式会社の沿革について、省略せずにまとめて下さい。)"
    ),
  url: z
    .string()
    .describe("取得したいhttpリクエスト先のアドレス(例:https://google.com)"),
});
type GetHttpContentsToolArgs = z.infer<typeof GetHttpContentsToolArgsSchema>;

const GetHttpContentsToolReturnSchema = z.string().describe("取得結果の要約");
type GetHttpContentsToolReturn = z.infer<
  typeof GetHttpContentsToolReturnSchema
>;

export class GetHttpContentsTool extends ToolWithGenerics<
  GetHttpContentsToolArgs,
  GetHttpContentsToolReturn
> {
  protected readonly client: GoogleGenAI;
  protected readonly modelName: string;

  constructor(client: GoogleGenAI, modelName: string) {
    super({
      description: "Webページの内容を取得し、要約します。",
      argsSchema: GetHttpContentsToolArgsSchema,
      returnSchema: GetHttpContentsToolReturnSchema,
    });
    this.client = client;
    this.modelName = modelName;
  }

  omitArgs(args: GetHttpContentsToolArgs): GetHttpContentsToolArgs {
    return args;
  }

  omitResult(result: string): string {
    return "（省略）";
  }

  protected async _executeTool(
    args: GetHttpContentsToolArgs
  ): Promise<GetHttpContentsToolReturn> {
    if (args.url === "") {
      throw new Error("args.GetHttpContentsTool.queryが空になっています。");
    }
    const url = args.url;
    const response = await axios.get(url, {
      headers: {
        // 一部のサイトではUser-Agentがないとアクセスを弾かれる場合があるため指定
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      },
    });

    let contents = response.data;

    if (typeof contents !== "string") {
      return "文字列以外の内容でした。内容を表示できません。";
    }

    if (args.summarize) {
      let error_count = 0;
      while (true) {
        try {
          const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: `以下は「${url}」から取得したコンテンツの内容です。\n以下の指示にしたがってプレーンテキスト化して下さい。\n【指示】${args.summary_instructions}\n\n【コンテンツ内容】\n${contents}`,
          });
          if (!response.text)
            throw new Error(
              "geminiからの回答に一切テキストが含まれませんでした。"
            );
          contents = response.text;
          break;
        } catch (e) {
          error_count++;
          if (error_count > 3) {
            console.warn(
              `警告: API呼び出し中に3回連続でエラーが発生しました: ${e}。異常終了します。`
            );
            throw e;
          }
          console.warn(
            `警告: API呼び出し中にエラーが発生しました: ${e}。30秒待機してリトライします。`
          );
          await new Promise((res) => setTimeout(res, 30000));
        }
      }
    }

    await new Promise((res) =>
      setTimeout(res, this.getRandomArbitrary(15000, 30000))
    ); // 連続でリクエストを送るとコンピュータであると認識される可能性があるため。

    return contents;
  }

  private getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }
}
