import { z } from "zod";
import { Tool } from "./Tool";
import { FileReaderTool } from "./FileReaderTool";
import { FileWriterTool } from "./FileWriterTool";
import { GetHttpContentsTool } from "./GetHttpContentsTool";
import { WebSearchTool } from "./WebSearchTool";

export const Tools = {
  FileReaderTool: new FileReaderTool(),
  FileWriterTool: new FileWriterTool(),
  WebSearchTool: new WebSearchTool(),
  GetHttpContentsTool: new GetHttpContentsTool(),
};
export const ToolArgsSchema = z.object({
  FileReaderTool: Tools.FileReaderTool.args_schema.optional(),
  FileWriterTool: Tools.FileWriterTool.args_schema.optional(),
  WebSearchTool: Tools.WebSearchTool.args_schema.optional(),
  GetHttpContentsTool: Tools.GetHttpContentsTool.args_schema.optional(),
});
export type ToolArgs = z.infer<typeof ToolArgsSchema>;
