import { z } from "zod";
import { Workspace } from "../core/Workspace";
import { ToolArgs } from "./Tools";

export interface ToolDescription {
  description: string;
}

export abstract class ToolWithGenerics<T> {
  abstract readonly args_schema: z.ZodTypeAny;
  abstract readonly description: string;

  abstract execute(args: ToolArgs, workspace: Workspace): Promise<T>;

  abstract omitArgs(args: ToolArgs): ToolArgs;

  abstract omitResult(result: T): T;

  getDescription(): string {
    return this.description;
  }
}

export abstract class Tool extends ToolWithGenerics<any> {}
