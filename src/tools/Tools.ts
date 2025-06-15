import { z } from "zod";
import { FileReaderArgsSchema, FileReaderTool } from "./FileReaderTool";
import { FileWriterArgsSchema, FileWriterTool } from "./FileWriterTool";

export const Tools = {
  FileReaderTool: new FileReaderTool(),
  FileWriterTool: new FileWriterTool(),
};

export const ToolArgsSchema = z.object({
  FileReaderTool: FileReaderArgsSchema.optional(),
  FileWriterTool: FileWriterArgsSchema.optional(),
});

export type ToolArgs = z.infer<typeof ToolArgsSchema>;
