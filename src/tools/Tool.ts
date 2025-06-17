import { z } from "zod";
import { Workspace } from "../core/Workspace";
import { ToolArgs } from "./Tools";

export interface ToolDescription {
  description: string;
}

export abstract class Tool {
  abstract readonly args_schema: z.ZodTypeAny;
  abstract readonly description: string;

  abstract execute(
    args: ToolArgs,
    workspace: Workspace
  ): Promise<any | undefined>;

  getDescription(): string {
    return this.description;
  }
}
