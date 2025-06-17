import { z } from "zod";
import { Tool } from "./Tool";
import { FileReaderTool } from "./FileReaderTool";
import { FileWriterTool } from "./FileWriterTool";
import { GetHttpContentsTool } from "./GetHttpContentsTool";
import { WebSearchTool } from "./WebSearchTool";

export const Tools = {
  FileReaderTool: new FileReaderTool(),
  FileWriterTool: new FileWriterTool(),
};
export const ToolArgsSchema = z.object({
  FileReaderTool: Tools.FileReaderTool.args_schema.optional(),
  FileWriterTool: Tools.FileWriterTool.args_schema.optional(),
});
export type ToolArgs = z.infer<typeof ToolArgsSchema>;
