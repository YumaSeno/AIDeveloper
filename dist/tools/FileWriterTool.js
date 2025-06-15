"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWriterTool = exports.FileWriterArgsSchema = exports.FileNameContentSetSchema = void 0;
const Tool_1 = require("./Tool");
const zod_1 = require("zod");
exports.FileNameContentSetSchema = zod_1.z.object({
    filename: zod_1.z.string().describe("パスを含むファイル名(例:docs/要件定義書.md)"),
    contents: zod_1.z.string().describe("ファイルの内容"),
});
exports.FileWriterArgsSchema = zod_1.z.object({
    artifacts: zod_1.z
        .array(exports.FileNameContentSetSchema)
        .describe("書き込みたいファイルとその内容の一覧"),
});
class FileWriterTool extends Tool_1.Tool {
    description = "指定された複数のファイルの内容を読み込み、その内容を返します。";
    args_schema = {
        filenames: "string[] (読み込むファイルパスのリスト)",
    };
    async execute(args, workspace) {
        if (!args.FileWriterTool) {
            throw new Error("引数 'args' 内のFileWriterToolが設定されていません。");
        }
        if (!Array.isArray(args.FileWriterTool.artifacts)) {
            throw new Error("引数 'args' 内の 'FileWriterTool.filenames' 内に取得したいファイル名のリストを含める必要があります。");
        }
        for (const artifact of args.FileWriterTool.artifacts) {
            await workspace.saveArtifact(artifact.filename, artifact.contents);
        }
        return "ファイルの書き込みが完了しました。";
    }
}
exports.FileWriterTool = FileWriterTool;
