import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import { ToolArgs } from "./Tools";
import axios from "axios";
import * as cheerio from "cheerio";

export const WebSearchToolArgsSchema = z.object({
  query: z.string().describe("検索用の文字列。"),
});
export type WebSearchToolArgs = z.infer<typeof WebSearchToolArgsSchema>;

const TARGET_URL = "https://duckduckgo.com/html";
interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export class WebSearchTool extends ToolWithGenerics<SearchResult[] | String> {
  readonly description =
    "キーワードに関連するウェブページの名前とアドレスを取得します。ページの情報を詳しく閲覧したい場合はGetHttpContentsToolを利用して下さい。";
  readonly args_schema = WebSearchToolArgsSchema;

  omitArgs(args: ToolArgs): ToolArgs {
    return args;
  }

  omitResult(result: SearchResult[] | String): SearchResult[] | String {
    return result;
  }

  async execute(
    args: ToolArgs,
    workspace: Workspace
  ): Promise<SearchResult[] | String> {
    if (!args.WebSearchTool) {
      throw new Error("引数 'args' 内に必要なパラメータが設定されていません。");
    }
    if (args.WebSearchTool.query == null || args.WebSearchTool.query === "") {
      throw new Error("args.WebSearchTool.queryが空になっています。");
    }
    try {
      const searchResults = await this.duckGo(args.WebSearchTool.query);
      await new Promise((res) => setTimeout(res, 5000)); // 連続でリクエストを送るとコンピュータであると認識される可能性があるため。
      return searchResults;
    } catch (error) {
      return "ツールの利用時にエラーが発生しました。";
    }
  }

  /**
   * DuckDuckGoでキーワード検索を行い、結果を整形して返す関数
   * @param keyword 検索キーワード
   * @returns 検索結果オブジェクトの配列、またはエラー時にundefined
   */
  async duckGo(keyword: string): Promise<SearchResult[]> {
    // axiosでHTMLコンテンツを取得
    const response = await axios.get(TARGET_URL, {
      params: { q: keyword },
      headers: {
        // 一部のサイトではUser-Agentがないとアクセスを弾かれる場合があるため指定
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:56.0) Gecko/20100101 Firefox/56.0 Waterfox/56.3",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        "Upgrade-Insecure-Requests": 1,
      },
    });

    const html = response.data;
    const $ = cheerio.load(html); // HTMLをCheerioオブジェクトとしてロード
    const results: SearchResult[] = [];

    // 検索結果の各要素をループ処理
    $("#links .result").each((index: number, element: cheerio.Element) => {
      const titleElement = $(element).find(".result__title a");
      const snippetElement = $(element).find(".result__snippet");

      // 各要素からテキストとURLを取得し、trim()で前後の空白を削除
      const title = titleElement.text().trim();
      const url = titleElement.attr("href") || ""; // href属性からURLを取得
      const snippet = snippetElement.text().trim();

      // タイトルとURLが存在する場合のみ結果に追加
      if (title && url) {
        results.push({
          title,
          snippet,
          url,
        });
      }
    });

    return results;
  }
}
