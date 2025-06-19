import { GoogleGenAI } from "@google/genai";
import { Agent } from "./agents/Agent";
import { PMAgent } from "./agents/PMAgent";
import { UserAgent } from "./agents/UserAgent";
import { AIAgent } from "./agents/AIAgent";
import { Logger } from "./core/Logger";
import { Workspace } from "./core/Workspace";
import { Tool } from "./tools/Tool";
import { CommandLineUI } from "./ui";
import {
  TurnOutput,
  ToolResult,
  PlanProjectAndKickoffSchema,
  getTurnOutputSchemaWithTools,
} from "./models";
import * as path from "path";
import * as fs from "fs/promises";

const META_DIR = "_meta";
const PLAN_FILE = "01_project_plan.json";

export class Orchestrator {
  private projectName!: string;
  private ui: CommandLineUI;
  private workspace!: Workspace;
  private logger!: Logger;
  private agents: Record<string, Agent> = {};
  private tools: Tool[];

  constructor(ui: CommandLineUI, tools: Tool[]) {
    this.ui = ui;
    this.tools = tools;
  }

  async setupProject(
    projectName: string,
    workspace: Workspace,
    client: GoogleGenAI,
    modelName: string,
    resume = false
  ): Promise<string> {
    this.projectName = projectName;
    this.workspace = workspace;
    this.ui.displayStatus(`📂 ワークスペース: ${this.workspace.projectPath}`);

    const metaDir = path.join(this.workspace.projectPath, META_DIR);
    await fs.mkdir(metaDir, { recursive: true });
    this.logger = new Logger(
      metaDir,
      resume ? "a" : "w",
      getTurnOutputSchemaWithTools(this.tools)
    );

    this.agents = {
      PM: new PMAgent(client, "PM", modelName),
      USER: new UserAgent("USER", this.ui),
    };

    if (resume) {
      this.ui.displayStatus("🔄 プロジェクトの状態を復元中...");
      await this.logger.loadFromFile();

      const planPath = path.join(metaDir, PLAN_FILE);
      try {
        await fs.access(planPath);
        const planData = await fs.readFile(planPath, "utf-8");
        const plan = PlanProjectAndKickoffSchema.parse(JSON.parse(planData));
        for (const info of Object.values(plan.team)) {
          if (!this.agents[info.name]) {
            this.agents[info.name] = new AIAgent({
              client: client,
              name: info.name,
              role: info.role,
              projectRole: info.project_role,
              detailedInstructions: info.detailed_instructions,
              modelName: modelName,
            });
          }
        }
        this.ui.displayStatus("✅ 開発チームの構成を復元しました。");
      } catch {
        this.ui.displayStatus(
          "ℹ️ チーム編成前です。要件定義フェーズから再開します。"
        );
      }

      const lastTurn = this.logger.getLastTurn();
      if (!lastTurn) throw new Error("ログが空です。");

      this.ui.printHeader("プロジェクト再開", "*");
      this.ui.displayMessage(lastTurn);

      if ("recipient" in lastTurn && lastTurn.target_type === "AGENT") {
        return lastTurn.recipient;
      } else if (
        "tool_name" in lastTurn ||
        ("target_type" in lastTurn && lastTurn.target_type === "TOOL")
      ) {
        const history = this.logger.getFullHistory();
        for (let i = history.length - 2; i >= 0; i--) {
          const prevTurn = history[i];
          if ("sender" in prevTurn) return prevTurn.sender;
        }
      }
      return "PM";
    } else {
      const firstTurn: TurnOutput = {
        sender: "",
        recipient: "PM",
        message:
          "プロジェクトを開始します。まずはUSERにヒアリングしてください。",
        target_type: "AGENT",
        tool_args: {},
        special_action: "_",
      };
      await this.logger.log(firstTurn);
      this.ui.displayMessage(firstTurn);
      const secondTurn: TurnOutput = {
        sender: "PM",
        recipient: "USER",
        message:
          "こんにちは！どのようなアプリケーションを開発したいですか？具体的に教えてください。",
        target_type: "AGENT",
        tool_args: {},
        special_action: "_",
      };
      await this.logger.log(secondTurn);
      this.ui.displayMessage(secondTurn);
      return "USER";
    }
  }

  async run(
    client: GoogleGenAI,
    nextSpeakerName: string,
    model_name: string
  ): Promise<void> {
    while (true) {
      const lastTurn = this.logger.getLastTurn();
      if (lastTurn && "special_action" in lastTurn) {
        if (lastTurn.special_action === "FINALIZE_REQUIREMENTS") {
          nextSpeakerName = await this._handleFinalizeRequirements(
            client,
            model_name
          );
          continue;
        } else if (lastTurn.special_action === "COMPLETE_PROJECT") {
          this.ui.printHeader("🎉 プロジェクト完了！ 🎉", "*");
          break;
        }
      }

      const currentAgent = this.agents[nextSpeakerName];
      if (!currentAgent)
        throw new Error(`エージェント '${nextSpeakerName}' が見つかりません。`);

      const personalHistory = this.logger.getPersonalHistory(currentAgent.name);
      const fileTree = await this.workspace.getFileTree();

      const responseTurn = await currentAgent.executeTurn(
        personalHistory,
        this.projectName,
        fileTree,
        this.tools,
        Object.values(this.agents)
      );
      responseTurn.sender = currentAgent.name;
      await this.logger.log(responseTurn);
      this.ui.displayMessage(responseTurn);

      if (responseTurn.target_type === "TOOL") {
        const toolResult = await this._executeTool(
          responseTurn.recipient,
          responseTurn.tool_args
        );
        await this.logger.log(toolResult);
        this.ui.displayMessage(toolResult);
        nextSpeakerName = currentAgent.name;
      } else if (responseTurn.target_type === "AGENT") {
        nextSpeakerName = responseTurn.recipient;
      } else {
        this.ui.displayError("無効なtarget_typeです。PMに制御を移します。");
        nextSpeakerName = "PM";
      }
    }
  }

  private async _executeTool(
    toolName: string,
    toolArgs: { [key: string]: any }
  ): Promise<ToolResult> {
    const toolRecord: Record<string, Tool> = {};
    for (const tool of this.tools) toolRecord[tool.constructor.name] = tool;
    const tool = toolRecord[toolName];
    if (!tool)
      return {
        tool_name: toolName,
        result: `エラー: ツール '${toolName}' が見つかりません。`,
        error: true,
      };

    if (!toolArgs[toolName])
      return {
        tool_name: toolName,
        result: `エラー: ツール '${toolName}' が見つかりません。`,
        error: true,
      };

    try {
      const result = await tool.execute(toolArgs[toolName]);
      return { tool_name: toolName, result, error: false };
    } catch (e) {
      return {
        tool_name: toolName,
        result: `エラー: ${e}`,
        error: true,
      };
    }
  }

  private async _handleFinalizeRequirements(
    client: GoogleGenAI,
    modelName: string
  ): Promise<string> {
    this.ui.printHeader("Phase 2: チーム編成とキックオフ", "-");
    const pm = this.agents["PM"];
    if (!(pm instanceof PMAgent)) throw new Error("PMAgentが見つかりません。");

    this.ui.displayStatus("🤔 PMがプロジェクト計画を策定中...");
    const plan = await pm.planProjectKickoff(
      this.logger,
      Object.values(this.agents)
    );

    await this.workspace.saveArtifact(
      PLAN_FILE,
      JSON.stringify(plan, null, 2),
      META_DIR
    );
    this.ui.displayStatus(
      `✅ プロジェクト計画を '${PLAN_FILE}' に保存しました。`
    );

    for (const info of plan.team) {
      if (!this.agents[info.name]) {
        this.agents[info.name] = new AIAgent({
          client: client,
          name: info.name,
          role: info.role,
          projectRole: info.project_role,
          detailedInstructions: info.detailed_instructions,
          modelName: modelName,
        });
      }
    }

    this.ui.displayStatus("\n✅ 新しい開発チームが編成されました！");
    Object.values(this.agents).forEach((agent) =>
      this.ui.displayStatus(` - ${agent.name} (${agent.role})`)
    );

    const broadcastTurn: TurnOutput = {
      sender: "PM",
      recipient: "ALL",
      message: plan.broadcast_message,
      target_type: "AGENT",
      tool_args: {},
      special_action: "_",
    };
    await this.logger.log(broadcastTurn);
    this.ui.displayMessage(broadcastTurn);

    const firstDirectiveTurn: TurnOutput = {
      sender: "PM",
      ...plan.first_directive,
      target_type: "AGENT",
      tool_args: {},
      special_action: "_",
    };
    await this.logger.log(firstDirectiveTurn);
    this.ui.displayMessage(firstDirectiveTurn);

    return firstDirectiveTurn.recipient;
  }
}
