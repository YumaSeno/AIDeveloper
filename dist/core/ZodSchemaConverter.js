"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaType = void 0;
exports.toGeminiSchema = toGeminiSchema;
const zod_1 = require("zod");
var SchemaType;
(function (SchemaType) {
    /** String type. */
    SchemaType["STRING"] = "string";
    /** Number type. */
    SchemaType["NUMBER"] = "number";
    /** Integer type. */
    SchemaType["INTEGER"] = "integer";
    /** Boolean type. */
    SchemaType["BOOLEAN"] = "boolean";
    /** Array type. */
    SchemaType["ARRAY"] = "array";
    /** Object type. */
    SchemaType["OBJECT"] = "object";
})(SchemaType || (exports.SchemaType = SchemaType = {}));
function decorateGeminiSchema(geminiSchema, zodSchema) {
    if (geminiSchema.nullable === undefined) {
        geminiSchema.nullable = zodSchema.isOptional();
    }
    if (zodSchema.description) {
        geminiSchema.description = zodSchema.description;
    }
    return geminiSchema;
}
function toGeminiSchema(zodSchema) {
    switch (true) {
        case zodSchema instanceof zod_1.z.ZodArray:
            return decorateGeminiSchema({
                type: SchemaType.ARRAY,
                items: toGeminiSchema(zodSchema.element),
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodObject:
            const properties = {};
            const required = [];
            Object.entries(zodSchema.shape).forEach(([key, value]) => {
                properties[key] = toGeminiSchema(value);
                if (!(value instanceof zod_1.z.ZodOptional)) {
                    required.push(key);
                }
            });
            return decorateGeminiSchema({
                type: SchemaType.OBJECT,
                properties,
                required: required.length > 0 ? required : undefined,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodString:
            return decorateGeminiSchema({
                type: SchemaType.STRING,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodNumber:
            return decorateGeminiSchema({
                type: SchemaType.NUMBER,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodBoolean:
            return decorateGeminiSchema({
                type: SchemaType.BOOLEAN,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodEnum:
            return decorateGeminiSchema({
                type: SchemaType.STRING,
                enum: zodSchema._def.values,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodDefault:
        case zodSchema instanceof zod_1.z.ZodNullable:
        case zodSchema instanceof zod_1.z.ZodOptional:
            const innerSchema = toGeminiSchema(zodSchema._def.innerType);
            return decorateGeminiSchema({
                ...innerSchema,
                nullable: true,
            }, zodSchema);
        case zodSchema instanceof zod_1.z.ZodLiteral:
            return decorateGeminiSchema({
                type: SchemaType.STRING,
                enum: [zodSchema._def.value],
            }, zodSchema);
        default:
            return decorateGeminiSchema({
                type: SchemaType.OBJECT,
                nullable: true,
            }, zodSchema);
    }
}
