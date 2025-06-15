"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileReaderTool = exports.FileReaderArgsSchema = void 0;
const Tool_1 = require("./Tool");
const zod_1 = require("zod");
exports.FileReaderArgsSchema = zod_1.z.object({
    filenames: zod_1.z.array(zod_1.z.string()).describe("読み込みたいファイルの一覧"),
});
class FileReaderTool extends Tool_1.Tool {
    description = "指定された複数のファイルの内容を読み込み、その内容を返します。";
    args_schema = {
        filenames: "string[] (読み込むファイルパスのリスト)",
    };
    async execute(args, workspace) {
        if (!args.FileReaderTool) {
            throw new Error("引数 'args' 内のFileReaderToolが設定されていません。");
        }
        if (!Array.isArray(args.FileReaderTool.filenames)) {
            throw new Error("引数 'args' 内の 'FileReaderTool.filenames' 内に取得したいファイル名のリストを含める必要があります。");
        }
        return workspace.readFiles(args.FileReaderTool.filenames);
    }
}
exports.FileReaderTool = FileReaderTool;
