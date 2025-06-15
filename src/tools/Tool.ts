import { Workspace } from "../core/Workspace";
import { ToolArgs } from "./Tools";

export interface ToolDescription {
  description: string;
  args_schema: Record<string, string>;
}

export abstract class Tool {
  abstract readonly description: string;
  abstract readonly args_schema: Record<string, string>;

  abstract execute(
    args: ToolArgs,
    workspace: Workspace
  ): Promise<any | undefined>;

  getDescriptionDict(): ToolDescription {
    return {
      description: this.description,
      args_schema: this.args_schema,
    };
  }
}
