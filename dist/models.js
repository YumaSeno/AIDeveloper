"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanProjectAndKickoffSchema = exports.FirstDirectiveSchema = exports.AgentExplanationSchema = exports.ToolResultSchema = exports.TurnOutputSchema = void 0;
const zod_1 = require("zod");
const Tools_1 = require("./tools/Tools");
exports.TurnOutputSchema = zod_1.z.object({
    sender: zod_1.z
        .string()
        .default("")
        .describe("この出力の送信元エージェント名。Orchestratorによって設定される。"),
    target_type: zod_1.z
        .enum(["AGENT", "TOOL"])
        .describe("次のアクションの対象がエージェントかツールか。"),
    recipient: zod_1.z
        .string()
        .describe("アクションの対象となるエージェント名またはツール名。"),
    special_action: zod_1.z
        .enum(["_", "FINALIZE_REQUIREMENTS", "COMPLETE_PROJECT"])
        .describe("プロジェクト進行に関わる特別なアクション。通常は未設定。"),
    message: zod_1.z
        .string()
        .default("")
        .describe("対象がエージェントの場合に送信するメッセージ。ツール利用時は設定不要。")
        .optional(),
    tool_args: Tools_1.ToolArgsSchema.describe("対象がツールの場合に、ツールに渡す引数をキーと値のペアで指定。ツールでない場合は空で設定。"),
    thought: zod_1.z.string().describe("なぜこの行動を選択したかの思考プロセス。"),
});
exports.ToolResultSchema = zod_1.z.object({
    tool_name: zod_1.z.string().describe("実行されたツールの名前。"),
    result: zod_1.z
        .any()
        .describe("ツール実行の結果。成功時はツール固有の出力、失敗時はエラーメッセージ。"),
    error: zod_1.z
        .boolean()
        .default(false)
        .describe("ツールの実行中にエラーが発生したかどうかを示すフラグ。"),
});
exports.AgentExplanationSchema = zod_1.z.object({
    name: zod_1.z.string().describe("エージェントの名前。"),
    role: zod_1.z
        .string()
        .describe("エージェントの一般的な役割（例：'バックエンド開発者'）。"),
    project_role: zod_1.z
        .string()
        .describe("このプロジェクトにおける、エージェントの具体的な役割と責任。"),
});
exports.FirstDirectiveSchema = zod_1.z.object({
    recipient: zod_1.z.string().describe("最初のタスクを割り当てるエージェント名。"),
    message: zod_1.z.string().describe("最初のタスクの具体的な指示内容。"),
});
exports.PlanProjectAndKickoffSchema = zod_1.z.object({
    team: zod_1.z
        .array(exports.AgentExplanationSchema)
        .describe("このプロジェクトのために編成する追加のチームメンバー。"),
    broadcast_message: zod_1.z
        .string()
        .describe("編成されたチーム全体に送る、プロジェクト開始のキックオフメッセージ。"),
    first_directive: exports.FirstDirectiveSchema.describe("最初のタスク指示。"),
    thought: zod_1.z
        .string()
        .describe("なぜこの計画（チーム編成、最初の指示）を立てたかの思考プロセス。"),
});
