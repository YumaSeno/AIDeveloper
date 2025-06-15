import { z } from "zod";

export enum SchemaType {
  /** String type. */
  STRING = "string",
  /** Number type. */
  NUMBER = "number",
  /** Integer type. */
  INTEGER = "integer",
  /** Boolean type. */
  BOOLEAN = "boolean",
  /** Array type. */
  ARRAY = "array",
  /** Object type. */
  OBJECT = "object",
}

function decorateGeminiSchema(geminiSchema: any, zodSchema: z.ZodTypeAny) {
  if (geminiSchema.nullable === undefined) {
    geminiSchema.nullable = zodSchema.isOptional();
  }

  if (zodSchema.description) {
    geminiSchema.description = zodSchema.description;
  }

  return geminiSchema;
}

export function toGeminiSchema(zodSchema: z.ZodTypeAny): any {
  switch (true) {
    case zodSchema instanceof z.ZodArray:
      return decorateGeminiSchema(
        {
          type: SchemaType.ARRAY,
          items: toGeminiSchema(zodSchema.element),
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodObject:
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(zodSchema.shape).forEach(([key, value]: [string, any]) => {
        properties[key] = toGeminiSchema(value);
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      });

      return decorateGeminiSchema(
        {
          type: SchemaType.OBJECT,
          properties,
          required: required.length > 0 ? required : undefined,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodString:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodNumber:
      return decorateGeminiSchema(
        {
          type: SchemaType.NUMBER,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodBoolean:
      return decorateGeminiSchema(
        {
          type: SchemaType.BOOLEAN,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodEnum:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
          enum: zodSchema._def.values,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodDefault:
    case zodSchema instanceof z.ZodNullable:
    case zodSchema instanceof z.ZodOptional:
      const innerSchema = toGeminiSchema(zodSchema._def.innerType);
      return decorateGeminiSchema(
        {
          ...innerSchema,
          nullable: true,
        },
        zodSchema
      );
    case zodSchema instanceof z.ZodLiteral:
      return decorateGeminiSchema(
        {
          type: SchemaType.STRING,
          enum: [zodSchema._def.value],
        },
        zodSchema
      );
    default:
      return decorateGeminiSchema(
        {
          type: SchemaType.OBJECT,
          nullable: true,
        },
        zodSchema
      );
  }
}
