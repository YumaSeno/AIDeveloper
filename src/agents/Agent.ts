import { ToolResult, TurnOutput } from "../models";
import { Tool } from "../tools/Tool";

export abstract class Agent {
  public readonly name: string;
  public readonly role: string;
  public readonly projectRole: string;
  public readonly detailedInstructions: string;

  constructor(args: {
    name: string;
    role: string;
    projectRole: string;
    detailedInstructions: string;
  }) {
    this.name = args.name;
    this.role = args.role;
    this.projectRole = args.projectRole;
    this.detailedInstructions = args.detailedInstructions;
  }

  abstract executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    project_name: string,
    fileTree: string,
    tools: Tool[],
    team: Agent[]
  ): Promise<TurnOutput>;
}
