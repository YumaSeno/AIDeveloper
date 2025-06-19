import { z } from "zod";
import { Tool } from "./tools/Tool";

const TurnOutputSchema = z.object({
  sender: z
    .string()
    .default("")
    .describe(
      "この出力の送信元エージェント名。システム側で設定するため設定不要。"
    ),
  target_type: z
    .enum(["AGENT", "TOOL"])
    .describe("次のアクションの対象がエージェントかツールか。"),
  recipient: z
    .string()
    .describe("アクションの対象となるエージェント名またはツール名。"),
  special_action: z
    .enum(["_", "FINALIZE_REQUIREMENTS", "COMPLETE_PROJECT"])
    .describe("プロジェクト進行に関わる特別なアクション。通常は未設定。"),
  message: z
    .string()
    .default("")
    .describe(
      "対象がエージェントの場合に送信するメッセージ。対象がツールの場合は設定しない。"
    )
    .optional(),
  tool_args: z
    .any()
    .describe(
      "対象がツールの場合に、ツールに渡す引数をキーと値のペアで指定。ツールでない場合は設定しない。"
    ),
});
const TurnOutputSchemaObjectToolArgs = TurnOutputSchema.extend({
  tool_args: z.object({}),
});
export function getTurnOutputSchemaWithTools(
  tools: Tool[]
): typeof TurnOutputSchemaObjectToolArgs {
  const zodTools: { [key: string]: z.ZodTypeAny } = {};
  for (const tool of tools) {
    zodTools[tool.constructor.name] = tool.argsSchema.optional();
  }
  const returnSchema = z.object({
    ...TurnOutputSchema.shape,
    tool_args: z
      .object(zodTools)
      .describe(
        "対象がツールの場合に、ツールに渡す引数をキーと値のペアで指定。ツールでない場合は設定しない。"
      ),
  });
  return returnSchema;
}
export type TurnOutput = z.infer<typeof TurnOutputSchema>;

export const ToolResultSchema = z.object({
  tool_name: z.string().describe("実行されたツールの名前。"),
  result: z
    .any()
    .describe(
      "ツール実行の結果。成功時はツール固有の出力、失敗時はエラーメッセージ。"
    ),
  error: z
    .boolean()
    .default(false)
    .describe("ツールの実行中にエラーが発生したかどうかを示すフラグ。"),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const AgentExplanationSchema = z.object({
  name: z.string().describe("エージェントの名前。"),
  role: z
    .string()
    .describe("エージェントの一般的な役割（例：'バックエンド開発者'）。"),
  project_role: z
    .string()
    .describe(
      "このプロジェクトにおける、エージェントの具体的な役割と責任。（例：'PHPを用いてサーバーサイドAPIとデータベースの設計・実装を担当します。会計ロジック、カルテ連携、各種マスタ管理機能のバックエンド開発に責任を持ちます。'）"
    ),
  detailed_instructions: z
    .string()
    .describe(
      "エージェント個人に対してのプロジェクトを通しての指示。このエージェントが意識すべきこと。（例：'PHPを用いてサーバーサイドAPIとデータベースの設計・実装を担当します。会計ロジック、カルテ連携、各種マスタ管理機能のバックエンド開発に責任を持ちます。'）"
    ),
});
export type AgentExplanation = z.infer<typeof AgentExplanationSchema>;

export const FirstDirectiveSchema = z.object({
  recipient: z.string().describe("最初のタスクを割り当てるエージェント名。"),
  message: z.string().describe("最初のタスクの具体的な指示内容。"),
});
export type FirstDirective = z.infer<typeof FirstDirectiveSchema>;

export const PlanProjectAndKickoffSchema = z.object({
  team: z
    .array(AgentExplanationSchema)
    .describe("このプロジェクトのために編成する追加のチームメンバー。"),
  broadcast_message: z
    .string()
    .describe(
      "編成されたチーム全体に送る、プロジェクト開始のキックオフメッセージ。"
    ),
  first_directive: FirstDirectiveSchema.describe("最初のタスク指示。"),
  thought: z
    .string()
    .describe(
      "なぜこの計画（チーム編成、最初の指示）を立てたかの思考プロセス。"
    ),
});
export type PlanProjectAndKickoff = z.infer<typeof PlanProjectAndKickoffSchema>;
