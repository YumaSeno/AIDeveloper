import { ToolWithGenerics } from "./Tool";
import { Workspace } from "../core/Workspace";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";
import { AxiosHeaders } from "axios";

const WebSearchToolArgsSchema = z.object({
  query: z.string().describe("検索用の文字列。"),
});
type WebSearchToolArgs = z.infer<typeof WebSearchToolArgsSchema>;

const SearchResultSchema = z.object({
  title: z.string(),
  snippet: z.string(),
  url: z.string(),
});
type SearchResult = z.infer<typeof SearchResultSchema>;

const WebSearchToolReturnSchema = z
  .union([z.array(SearchResultSchema), z.string()])
  .describe("検索結果");
type WebSearchToolReturn = z.infer<typeof WebSearchToolReturnSchema>;

export class WebSearchTool extends ToolWithGenerics<
  WebSearchToolArgs,
  WebSearchToolReturn
> {
  protected readonly TARGET_URL = "https://duckduckgo.com/html";
  protected readonly headers = [
    // --- セット 1 ---
    {
      // [Linux / Chrome] モダンなClient Hintsヘッダーを含む
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "sec-ch-ua":
        '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Linux"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ja-JP,ja;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.google.com/",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    },
    // --- セット 2 ---
    {
      // [Linux / Firefox]
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate, br",
      "Upgrade-Insecure-Requests": "1",
    },
    // --- セット 3 ---
    {
      // [Windows / Chrome] 最も一般的なデスクトップ環境
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "sec-ch-ua":
        '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.google.com/",
      "Upgrade-Insecure-Requests": "1",
    },
    // --- セット 4 ---
    {
      // [macOS / Safari] Mac環境を代表するブラウザ
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja-JP,ja;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.google.com/",
    },
    // --- セット 5 ---
    {
      // [Android / Chrome] モバイル環境
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua":
        '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?1", // モバイルを示す
      "sec-ch-ua-platform": '"Android"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.google.com/",
      "Upgrade-Insecure-Requests": "1",
    },
    // --- ここから追加したヘッダー ---
    // --- セット 6 ---
    {
      // [Windows / Edge] WindowsでChromeに次ぐシェア
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
      "sec-ch-ua":
        '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ja,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.bing.com/",
    },
    // --- セット 7 ---
    {
      // [iOS / Safari (iPhone)] 代表的なモバイル環境
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja-JP",
      "Accept-Encoding": "gzip, deflate, br",
    },
    // --- セット 8 ---
    {
      // [macOS / Chrome] MacユーザーのChrome環境
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "sec-ch-ua":
        '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
    },
    // --- セット 9 ---
    {
      // [Linux / Firefox (最新版)]
      "User-Agent":
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
    },
    // --- セット 10 ---
    {
      // [Windows / Opera]
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/110.0.0.0",
      "sec-ch-ua": '"Opera";v="110", "Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
    },
  ];
  protected headerIndex = 0;

  constructor() {
    super({
      description:
        "キーワードに関連するウェブページの名前とアドレスを取得します。ページの情報を詳しく閲覧したい場合はGetHttpContentsToolを利用して下さい。",
      argsSchema: WebSearchToolArgsSchema,
      returnSchema: WebSearchToolReturnSchema,
    });
  }

  omitArgs(passedTurns: number, args: WebSearchToolArgs): WebSearchToolArgs {
    return args;
  }

  omitResult(
    passedTurns: number,
    result: WebSearchToolReturn
  ): WebSearchToolReturn {
    if (passedTurns < 5 || "string" == typeof result) return result;
    return result.map((result) => ({ ...result, snippet: "省略" }));
  }

  protected async _executeTool(
    args: WebSearchToolArgs
  ): Promise<WebSearchToolReturn> {
    if (args.query == null || args.query === "") {
      throw new Error("args.WebSearchTool.queryが空になっています。");
    }
    try {
      const searchResults = await this.duckGo(args.query);
      await new Promise((res) =>
        setTimeout(res, this.getRandomArbitrary(15000, 30000))
      ); // 連続でリクエストを送るとコンピュータであると認識される可能性があるため。
      if (searchResults.length == 0) return "結果が取得できませんでした。";
      return searchResults;
    } catch (error) {
      throw "ツールの利用時にエラーが発生しました。";
    }
  }

  private getHeaderAndLotation(): object {
    const returnHeader = this.headers[this.headerIndex];
    this.headerIndex++;
    if (this.headerIndex >= this.headers.length) this.headerIndex = 0;
    return returnHeader;
  }

  private getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  /**
   * DuckDuckGoでキーワード検索を行い、結果を整形して返す関数
   * @param keyword 検索キーワード
   * @returns 検索結果オブジェクトの配列、またはエラー時にundefined
   */
  private async duckGo(keyword: string): Promise<SearchResult[]> {
    // axiosでHTMLコンテンツを取得
    const response = await axios.get(this.TARGET_URL, {
      params: { q: keyword },
      headers: this.getHeaderAndLotation(),
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
