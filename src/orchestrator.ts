import { GoogleGenerativeAI } from "@google/generative-ai";
import { Agent } from "./agents/Agent";
import { PMAgent } from "./agents/PMAgent";
import { UserAgent } from "./agents/UserAgent";
import { AIAgent } from "./agents/AIAgent";
import { Logger } from "./core/Logger";
import { Workspace } from "./core/Workspace";
import { FileReaderTool } from "./tools/FileReaderTool";
import { Tool } from "./tools/Tool";
import { CommandLineUI } from "./ui";
import { TurnOutput, ToolResult, PlanProjectAndKickoffSchema } from "./models";
import * as path from "path";
import * as fs from "fs/promises";

const META_DIR = "_meta";
const PLAN_FILE = "01_project_plan.json";

export class Orchestrator {
  private ui: CommandLineUI;
  private workspace!: Workspace;
  private logger!: Logger;
  private agents: Record<string, Agent> = {};
  private tools: Record<string, Tool> = {};

  constructor(ui: CommandLineUI) {
    this.ui = ui;
  }

  private async _setupProject(
    projectName: string,
    client: GoogleGenerativeAI,
    model_name: string,
    resume = false
  ): Promise<string> {
    this.workspace = new Workspace(
      projectName || `autogen_project_${Date.now()}`
    );
    this.ui.displayStatus(`📂 ワークスペース: ${this.workspace.projectPath}`);

    const metaDir = path.join(this.workspace.projectPath, META_DIR);
    await fs.mkdir(metaDir, { recursive: true });
    this.logger = new Logger(metaDir, resume ? "a" : "w");

    this.tools = { [new FileReaderTool().name]: new FileReaderTool() };
    this.agents = {
      PM: new PMAgent(client, "PM", model_name),
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
        for (const [name, info] of Object.entries(plan.team)) {
          if (!this.agents[name]) {
            this.agents[name] = new AIAgent(
              client,
              name,
              info.role,
              info.project_role,
              model_name
            );
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
        sender: "System",
        recipient: "PM",
        message:
          "プロジェクトを開始します。まずはUSERにヒアリングしてください。",
        thought: "プロジェクト開始のトリガー",
        target_type: "AGENT",
        tool_args: {},
        artifacts: [],
        special_action: "",
      };
      await this.logger.log(firstTurn);
      this.ui.displayMessage(firstTurn);
      const secondTurn: TurnOutput = {
        sender: "PM",
        recipient: "USER",
        message:
          "こんにちは！どのようなアプリケーションを開発したいですか？具体的に教えてください。",
        thought: "ユーザへの最初の聞き取り",
        target_type: "AGENT",
        tool_args: {},
        artifacts: [],
        special_action: "",
      };
      await this.logger.log(secondTurn);
      this.ui.displayMessage(secondTurn);
      return "PM";
    }
  }

  async setupNewProject(
    client: GoogleGenerativeAI,
    model_name: string
  ): Promise<string> {
    const projectName = await this.ui.getUserInput(
      "新しいプロジェクト名を入力: "
    );
    return this._setupProject(projectName, client, model_name, false);
  }

  async setupResumeProject(
    client: GoogleGenerativeAI,
    model_name: string
  ): Promise<string> {
    const projectName = await this.ui.getUserInput(
      "再開するプロジェクト名を入力: "
    );
    return this._setupProject(projectName, client, model_name, true);
  }

  async run(
    client: GoogleGenerativeAI,
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
        fileTree,
        this.tools
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
    toolArgs: Record<string, Record<string, any>>
  ): Promise<ToolResult> {
    const tool = this.tools[toolName];
    if (!tool)
      return {
        tool_name: toolName,
        result: `エラー: ツール '${toolName}' が見つかりません。`,
        error: true,
        sender: "System",
      };

    try {
      const result = await tool.execute(toolArgs, this.workspace);
      return { tool_name: toolName, result, error: false, sender: "System" };
    } catch (e) {
      return {
        tool_name: toolName,
        result: `エラー: ${e}`,
        error: true,
        sender: "System",
      };
    }
  }

  private async _handleFinalizeRequirements(
    client: GoogleGenerativeAI,
    model_name: string
  ): Promise<string> {
    this.ui.printHeader("Phase 2: チーム編成とキックオフ", "-");
    const pm = this.agents["PM"];
    if (!(pm instanceof PMAgent)) throw new Error("PMAgentが見つかりません。");

    this.ui.displayStatus("🤔 PMがプロジェクト計画を策定中...");
    const plan = await pm.planProjectKickoff(this.logger);

    const planPath = path.join(this.workspace.projectPath, META_DIR, PLAN_FILE);
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
    this.ui.displayStatus(
      `✅ プロジェクト計画を '${planPath}' に保存しました。`
    );

    for (const [name, info] of Object.entries(plan.team)) {
      if (!this.agents[name]) {
        this.agents[name] = new AIAgent(
          client,
          name,
          info.role,
          info.project_role,
          model_name
        );
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
      thought: plan.thought,
      target_type: "AGENT",
      tool_args: {},
      artifacts: [],
      special_action: "",
    };
    await this.logger.log(broadcastTurn);
    this.ui.displayMessage(broadcastTurn);

    const firstDirectiveTurn: TurnOutput = {
      sender: "PM",
      ...plan.first_directive,
      thought: "最初のタスク指示",
      target_type: "AGENT",
      tool_args: {},
      artifacts: [],
      special_action: "",
    };
    await this.logger.log(firstDirectiveTurn);
    this.ui.displayMessage(firstDirectiveTurn);

    return firstDirectiveTurn.recipient;
  }
}
