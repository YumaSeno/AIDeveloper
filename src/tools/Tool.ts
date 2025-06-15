import { Workspace } from "../core/Workspace";

export interface ToolDescription {
  name: string;
  description: string;
  args_schema: Record<string, string>;
}

export abstract class Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly args_schema: Record<string, string>;

  abstract execute(args: any, workspace: Workspace): Promise<any>;
  
  getDescriptionDict(): ToolDescription {
    return {
      name: this.name,
      description: this.description,
      args_schema: this.args_schema
    };
  }
}