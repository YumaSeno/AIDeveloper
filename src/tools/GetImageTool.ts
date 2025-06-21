import { ToolWithGenerics } from "./Tool";
import { z } from "zod";
import * as path from "path";
import * as fs from "node:fs";

// ツールが受け取る引数のスキーマ定義
const GetImageToolArgsSchema = z.object({
  filePath: z
    .string()
    .describe(
      "取得したい画像ファイルへのパス。相対パスで指定して下さい。(例: images/photo.png)"
    ),
});
type GetImageToolArgs = z.infer<typeof GetImageToolArgsSchema>;

// ツールの返り値のスキーマ定義
const GetImageToolReturnSchema = z
  .string()
  .describe("画像取得処理の結果メッセージ");
type GetImageToolReturn = z.infer<typeof GetImageToolReturnSchema>;

/**
 * ワークスペース内の画像ファイルを取得（存在確認）するツール。
 * PIL.ImageのNode.jsにおける代替実装として、ファイルパスを操作します。
 */
export class GetImageTool extends ToolWithGenerics<
  GetImageToolArgs,
  GetImageToolReturn
> {
  // このツールが動作する基準となるワークスペースのパス
  protected readonly workspacePath: string;

  /**
   * @param workspacePath AIエージェントがファイルを読み書きできるワークスペースの絶対パス
   */
  constructor(workspacePath: string) {
    super({
      description:
        "画像ファイルの存在を確認し、そのパスを取得します。(想定利用方法：ShellCommandToolにてヘッドレスChromeでスクリーンショットを保存後、それを確認する。)",
      argsSchema: GetImageToolArgsSchema,
      returnSchema: GetImageToolReturnSchema,
    });
    this.workspacePath = path.resolve(workspacePath);
  }

  omitArgs(args: GetImageToolArgs): GetImageToolArgs {
    return args;
  }

  omitResult(result: GetImageToolReturn): string {
    return "（省略）";
  }

  /**
   * ツールの本体処理。指定された相対パスの画像ファイルが存在するか確認します。
   * @param args ツール実行のための引数
   * @returns 処理結果のメッセージ
   */
  protected async _executeTool(
    args: GetImageToolArgs
  ): Promise<GetImageToolReturn> {
    if (!args.filePath) {
      throw new Error(
        "引数 `filePath` が空です。ファイルパスを指定して下さい。"
      );
    }

    // ワークスペースからの相対パスと結合して、ファイルの絶対パスを生成
    // path.joinだけだと'../'のようなトラバーサル攻撃に脆弱なため、resolveで正規化する
    const absolutePath = path.resolve(this.workspacePath, args.filePath);

    // セキュリティチェック：解決されたパスがワークスペースディレクトリ内にあることを確認
    if (!absolutePath.startsWith(this.workspacePath)) {
      throw new Error(
        `不正なファイルパスです。ワークスペース外のディレクトリにはアクセスできません。`
      );
    }

    try {
      const base64ImageFile = fs.readFileSync(absolutePath, {
        encoding: "base64",
      });

      // 成功した場合、AIエージェントにファイルが利用可能であることを伝えるメッセージを返す
      return base64ImageFile;
    } catch (error) {
      // ファイルが存在しない、または読み取れない場合
      throw new Error(
        `指定されたパスにファイルが見つからないか、アクセス権がありません: ${args.filePath}`
      );
    }
  }
}
