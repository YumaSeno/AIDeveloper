import * as fs from "fs/promises";
import * as nodefs from "node:fs";
import * as path from "path";

const WORKSPACE_DIR = "workspace";
const META_DIR = "_meta";

export class Workspace {
  public readonly projectPath: string;

  constructor(projectName: string) {
    this.projectPath = Workspace.getResolvePathSafe(WORKSPACE_DIR, projectName);
    // 同期的にディレクトリを作成（初期化時のみ）
    fs.mkdir(this.projectPath, { recursive: true });
  }

  static getResolvePathSafe(baseDir: string, ...userPaths: string[]): string {
    // 1. ベースディレクトリの絶対パスを取得・正規化する
    const resolvedBaseDir: string = path.resolve(baseDir);

    // 2. ベースディレクトリとユーザー入力を結合する
    // スプレッド構文(...)を使い、userPaths配列の全要素をpath.joinの引数として渡す
    const joinedPath: string = path.join(resolvedBaseDir, ...userPaths);

    // 3. 結合後のパスを絶対パスとして正規化する
    const resolvedJoinedPath: string = path.resolve(joinedPath);

    // 4. 結合後の正規化パスが、ベースディレクトリのパスで始まっているかを確認
    // resolvedBaseDir に path.sep を追加することで、
    // /base/dir と /base/dir-something のような類似ディレクトリを誤って許可するのを防ぐ
    // また、ベースディレクトリそのものへのアクセスも許可する (resolvedJoinedPath === resolvedBaseDir)
    if (
      resolvedJoinedPath.startsWith(resolvedBaseDir + path.sep) ||
      resolvedJoinedPath === resolvedBaseDir
    ) {
      return resolvedJoinedPath;
    }

    // ベースディレクトリの外に出ようとしている場合は null を返す
    const attemptedPath = userPaths.join("/");
    throw new Error(
      `不正なアクセスが試みられました。ワークスペース以下のファイルのみ操作できます。: ${attemptedPath}`
    );
  }

  getImageBase64(filename: string, subDir = ""): string {
    const fullPath = Workspace.getResolvePathSafe(
      this.projectPath,
      subDir,
      filename
    );
    return nodefs.readFileSync(fullPath, {
      encoding: "base64",
    });
  }

  async getFileTree(): Promise<string> {
    const walk = async (dir: string, level = 0): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let tree: string[] = [];

      for (const entry of entries) {
        if (entry.name === META_DIR) continue;

        const indent = " ".repeat(4 * level);
        if (entry.isDirectory()) {
          tree.push(`${indent}${entry.name}/`);
          tree.push(
            ...(await walk(
              Workspace.getResolvePathSafe(dir, entry.name),
              level + 1
            ))
          );
        } else {
          tree.push(`${indent}${entry.name}`);
        }
      }
      return tree;
    };
    const treeLines = await walk(this.projectPath);
    return treeLines.join("\n");
  }

  async saveArtifact(
    filename: string,
    content: string,
    subDir = ""
  ): Promise<void> {
    const fullPath = path.join(this.projectPath, subDir, filename);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async readFiles(filenames: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const filename of filenames) {
      const fullPath = Workspace.getResolvePathSafe(this.projectPath, filename);
      try {
        contents[filename] = await fs.readFile(fullPath, "utf-8");
      } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "ENOENT") {
          contents[
            filename
          ] = `ERROR: ファイル '${filename}' が見つかりません。`;
        } else if (e instanceof Error) {
          contents[
            filename
          ] = `ERROR: ファイル '${filename}' の読み込み中にエラーが発生しました: ${e.message}`;
        } else {
          contents[
            filename
          ] = `ERROR: ファイル '${filename}' の読み込み中に不明なエラーが発生しました。`;
        }
      }
    }
    return contents;
  }
}
