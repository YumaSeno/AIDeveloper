"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const WORKSPACE_DIR = "workspace";
const META_DIR = "_meta";
class Workspace {
    projectPath;
    constructor(projectName) {
        this.projectPath = path.join(WORKSPACE_DIR, projectName);
        // 同期的にディレクトリを作成（初期化時のみ）
        fs.mkdir(this.projectPath, { recursive: true });
    }
    async saveArtifact(filename, content, subDir = "") {
        const fullPath = path.join(this.projectPath, subDir, filename);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
    }
    async getFileTree() {
        const walk = async (dir, level = 0) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let tree = [];
            for (const entry of entries) {
                if (entry.name === META_DIR)
                    continue;
                const indent = ' '.repeat(4 * level);
                if (entry.isDirectory()) {
                    tree.push(`${indent}${entry.name}/`);
                    tree.push(...await walk(path.join(dir, entry.name), level + 1));
                }
                else {
                    tree.push(`${indent}${entry.name}`);
                }
            }
            return tree;
        };
        const treeLines = await walk(this.projectPath);
        return treeLines.join('\n');
    }
    async readFiles(filenames) {
        const contents = {};
        for (const filename of filenames) {
            const fullPath = path.join(this.projectPath, filename);
            try {
                contents[filename] = await fs.readFile(fullPath, 'utf-8');
            }
            catch (e) {
                if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
                    contents[filename] = `ERROR: ファイル '${filename}' が見つかりません。`;
                }
                else if (e instanceof Error) {
                    contents[filename] = `ERROR: ファイル '${filename}' の読み込み中にエラーが発生しました: ${e.message}`;
                }
                else {
                    contents[filename] = `ERROR: ファイル '${filename}' の読み込み中に不明なエラーが発生しました。`;
                }
            }
        }
        return contents;
    }
}
exports.Workspace = Workspace;
