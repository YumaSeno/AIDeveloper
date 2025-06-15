import * as fs from 'fs/promises';
import * as path from 'path';

const WORKSPACE_DIR = "workspace";
const META_DIR = "_meta";

export class Workspace {
  public readonly projectPath: string;

  constructor(projectName: string) {
    this.projectPath = path.join(WORKSPACE_DIR, projectName);
    // 同期的にディレクトリを作成（初期化時のみ）
    fs.mkdir(this.projectPath, { recursive: true });
  }

  async saveArtifact(filename: string, content: string, subDir = ""): Promise<void> {
    const fullPath = path.join(this.projectPath, subDir, filename);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async getFileTree(): Promise<string> {
    const walk = async (dir: string, level = 0): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let tree: string[] = [];

      for (const entry of entries) {
        if (entry.name === META_DIR) continue;

        const indent = ' '.repeat(4 * level);
        if (entry.isDirectory()) {
          tree.push(`${indent}${entry.name}/`);
          tree.push(...await walk(path.join(dir, entry.name), level + 1));
        } else {
          tree.push(`${indent}${entry.name}`);
        }
      }
      return tree;
    };
    const treeLines = await walk(this.projectPath);
    return treeLines.join('\n');
  }

  async readFiles(filenames: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const filename of filenames) {
      const fullPath = path.join(this.projectPath, filename);
      try {
        contents[filename] = await fs.readFile(fullPath, 'utf-8');
      } catch (e) {
        if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
          contents[filename] = `ERROR: ファイル '${filename}' が見つかりません。`;
        } else if (e instanceof Error) {
          contents[filename] = `ERROR: ファイル '${filename}' の読み込み中にエラーが発生しました: ${e.message}`;
        } else {
          contents[filename] = `ERROR: ファイル '${filename}' の読み込み中に不明なエラーが発生しました。`;
        }
      }
    }
    return contents;
  }
}