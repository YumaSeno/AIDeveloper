"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolArgsSchema = exports.Tools = void 0;
const zod_1 = require("zod");
const FileReaderTool_1 = require("./FileReaderTool");
const FileWriterTool_1 = require("./FileWriterTool");
exports.Tools = {
    FileReaderTool: new FileReaderTool_1.FileReaderTool(),
    FileWriterTool: new FileWriterTool_1.FileWriterTool(),
};
exports.ToolArgsSchema = zod_1.z.object({
    FileReaderTool: FileReaderTool_1.FileReaderArgsSchema.optional(),
    FileWriterTool: FileWriterTool_1.FileWriterArgsSchema.optional(),
});
