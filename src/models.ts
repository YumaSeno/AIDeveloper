import { z } from 'zod';

export const TurnOutputSchema = z.object({
  target_type: z.enum(["AGENT", "TOOL"]).describe("次のアクションの対象がエージェントかツールか。"),
  recipient: z.string().describe("アクションの対象となるエージェント名またはツール名。"),
  tool_args: z.record(z.any()).default({}).describe("対象がツールの場合に、ツールに渡す引数をキーと値のペアで指定。"),
  message: z.string().default("").describe("対象がエージェントの場合に送信するメッセージ。"),
  artifacts: z.array(z.object({
    filename: z.string(),
    content: z.string()
  })).default([]).describe("ファイルとして成果物を出力する場合に指定。'filename'と'content'の辞書のリスト。"),
  special_action: z.enum(["", "FINALIZE_REQUIREMENTS", "COMPLETE_PROJECT"]).default("").describe("プロジェクト進行に関わる特別なアクション。"),
  thought: z.string().describe("なぜこの行動を選択したかの思考プロセス。"),
  sender: z.string().default("").describe("この出力の送信元エージェント名。Orchestratorによって設定される。"),
});
export type TurnOutput = z.infer<typeof TurnOutputSchema>;

export const ToolResultSchema = z.object({
  tool_name: z.string().describe("実行されたツールの名前。"),
  result: z.any().describe("ツール実行の結果。成功時はツール固有の出力、失敗時はエラーメッセージ。"),
  error: z.boolean().default(false).describe("ツールの実行中にエラーが発生したかどうかを示すフラグ。"),
  sender: z.string().default("System").describe("ツールの実行主体。通常は'System'。"),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const AgentExplanationSchema = z.object({
  role: z.string().describe("エージェントの一般的な役割（例：'バックエンド開発者'）。"),
  project_role: z.string().describe("このプロジェクトにおける、エージェントの具体的な役割と責任。"),
});
export type AgentExplanation = z.infer<typeof AgentExplanationSchema>;

export const FirstDirectiveSchema = z.object({
  recipient: z.string().describe("最初のタスクを割り当てるエージェント名。"),
  message: z.string().describe("最初のタスクの具体的な指示内容。"),
});
export type FirstDirective = z.infer<typeof FirstDirectiveSchema>;

export const PlanProjectAndKickoffSchema = z.object({
  thought: z.string().describe("なぜこの計画（チーム編成、最初の指示）を立てたかの思考プロセス。"),
  team: z.record(AgentExplanationSchema).describe("このプロジェクトのために編成する追加のチームメンバー。キーはエージェント名。"),
  broadcast_message: z.string().describe("編成されたチーム全体に送る、プロジェクト開始のキックオフメッセージ。"),
  first_directive: FirstDirectiveSchema.describe("最初のタスク指示。"),
});
export type PlanProjectAndKickoff = z.infer<typeof PlanProjectAndKickoffSchema>;