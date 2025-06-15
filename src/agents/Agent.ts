import { ToolResult, TurnOutput } from "../models";
import { Tool } from "../tools/Tool";

export abstract class Agent {
  public readonly name: string;
  public readonly role: string;
  public readonly projectRole: string;

  constructor(name: string, role: string, projectRole: string) {
    this.name = name;
    this.role = role;
    this.projectRole = projectRole;
  }

  abstract executeTurn(
    personalHistory: (TurnOutput | ToolResult)[],
    fileTree: string,
    tools: Record<string, Tool>,
    team: Agent[]
  ): Promise<TurnOutput>;
}
