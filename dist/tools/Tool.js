"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tool = void 0;
class Tool {
    getDescriptionDict() {
        return {
            description: this.description,
            args_schema: this.args_schema,
        };
    }
}
exports.Tool = Tool;
