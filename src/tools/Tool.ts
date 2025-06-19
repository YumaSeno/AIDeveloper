import { z } from "zod";

export interface ToolDescription {
  description: string;
}

export abstract class ToolWithGenerics<T, U> {
  readonly description: string;
  readonly argsSchema: z.ZodTypeAny;
  readonly returnSchema: z.ZodTypeAny;

  abstract _executeTool(args: T): Promise<U>;
  abstract omitArgs(args: T): T;
  abstract omitResult(result: U): U;

  constructor(args: {
    description: string;
    argsSchema: z.ZodTypeAny;
    returnSchema: z.ZodTypeAny;
  }) {
    this.description = args.description;
    this.argsSchema = args.argsSchema;
    this.returnSchema = args.returnSchema;
  }

  async execute(args: any): Promise<U> {
    return this._executeTool(this.argsSchema.parse(args));
  }

  getDescription(): string {
    return this.description;
  }
}

export abstract class Tool extends ToolWithGenerics<any, any> {}
