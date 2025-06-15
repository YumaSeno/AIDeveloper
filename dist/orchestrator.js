"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const PMAgent_1 = require("./agents/PMAgent");
const UserAgent_1 = require("./agents/UserAgent");
const AIAgent_1 = require("./agents/AIAgent");
const Logger_1 = require("./core/Logger");
const Workspace_1 = require("./core/Workspace");
const models_1 = require("./models");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const Tools_1 = require("./tools/Tools");
const META_DIR = "_meta";
const PLAN_FILE = "01_project_plan.json";
class Orchestrator {
    ui;
    workspace;
    logger;
    agents = {};
    tools = Tools_1.Tools;
    constructor(ui) {
        this.ui = ui;
    }
    async _setupProject(projectName, client, model_name, resume = false) {
        this.workspace = new Workspace_1.Workspace(projectName || `autogen_project_${Date.now()}`);
        this.ui.displayStatus(`📂 ワークスペース: ${this.workspace.projectPath}`);
        const metaDir = path.join(this.workspace.projectPath, META_DIR);
        await fs.mkdir(metaDir, { recursive: true });
        this.logger = new Logger_1.Logger(metaDir, resume ? "a" : "w");
        this.agents = {
            PM: new PMAgent_1.PMAgent(client, "PM", model_name),
            USER: new UserAgent_1.UserAgent("USER", this.ui),
        };
        if (resume) {
            this.ui.displayStatus("🔄 プロジェクトの状態を復元中...");
            await this.logger.loadFromFile();
            const planPath = path.join(metaDir, PLAN_FILE);
            try {
                await fs.access(planPath);
                const planData = await fs.readFile(planPath, "utf-8");
                const plan = models_1.PlanProjectAndKickoffSchema.parse(JSON.parse(planData));
                for (const info of Object.values(plan.team)) {
                    if (!this.agents[info.name]) {
                        this.agents[info.name] = new AIAgent_1.AIAgent(client, info.name, info.role, info.project_role, model_name);
                    }
                }
                this.ui.displayStatus("✅ 開発チームの構成を復元しました。");
            }
            catch {
                this.ui.displayStatus("ℹ️ チーム編成前です。要件定義フェーズから再開します。");
            }
            const lastTurn = this.logger.getLastTurn();
            if (!lastTurn)
                throw new Error("ログが空です。");
            this.ui.printHeader("プロジェクト再開", "*");
            this.ui.displayMessage(lastTurn);
            if ("recipient" in lastTurn && lastTurn.target_type === "AGENT") {
                return lastTurn.recipient;
            }
            else if ("tool_name" in lastTurn ||
                ("target_type" in lastTurn && lastTurn.target_type === "TOOL")) {
                const history = this.logger.getFullHistory();
                for (let i = history.length - 2; i >= 0; i--) {
                    const prevTurn = history[i];
                    if ("sender" in prevTurn)
                        return prevTurn.sender;
                }
            }
            return "PM";
        }
        else {
            const firstTurn = {
                sender: "",
                recipient: "PM",
                message: "プロジェクトを開始します。まずはUSERにヒアリングしてください。",
                thought: "プロジェクト開始のトリガー",
                target_type: "AGENT",
                tool_args: {},
                special_action: "_",
            };
            await this.logger.log(firstTurn);
            this.ui.displayMessage(firstTurn);
            const secondTurn = {
                sender: "PM",
                recipient: "USER",
                message: "こんにちは！どのようなアプリケーションを開発したいですか？具体的に教えてください。",
                thought: "ユーザへの最初の聞き取り",
                target_type: "AGENT",
                tool_args: {},
                special_action: "_",
            };
            await this.logger.log(secondTurn);
            this.ui.displayMessage(secondTurn);
            return "USER";
        }
    }
    async setupNewProject(client, model_name) {
        const projectName = await this.ui.getUserInput("新しいプロジェクト名を入力: ");
        return this._setupProject(projectName, client, model_name, false);
    }
    async setupResumeProject(client, model_name) {
        const projectName = await this.ui.getUserInput("再開するプロジェクト名を入力: ");
        return this._setupProject(projectName, client, model_name, true);
    }
    async run(client, nextSpeakerName, model_name) {
        while (true) {
            const lastTurn = this.logger.getLastTurn();
            if (lastTurn && "special_action" in lastTurn) {
                if (lastTurn.special_action === "FINALIZE_REQUIREMENTS") {
                    nextSpeakerName = await this._handleFinalizeRequirements(client, model_name);
                    continue;
                }
                else if (lastTurn.special_action === "COMPLETE_PROJECT") {
                    this.ui.printHeader("🎉 プロジェクト完了！ 🎉", "*");
                    break;
                }
            }
            const currentAgent = this.agents[nextSpeakerName];
            if (!currentAgent)
                throw new Error(`エージェント '${nextSpeakerName}' が見つかりません。`);
            const personalHistory = this.logger.getPersonalHistory(currentAgent.name);
            const fileTree = await this.workspace.getFileTree();
            const responseTurn = await currentAgent.executeTurn(personalHistory, fileTree, this.tools, Object.values(this.agents));
            responseTurn.sender = currentAgent.name;
            await this.logger.log(responseTurn);
            this.ui.displayMessage(responseTurn);
            if (responseTurn.target_type === "TOOL") {
                const toolResult = await this._executeTool(responseTurn.recipient, responseTurn.tool_args);
                await this.logger.log(toolResult);
                this.ui.displayMessage(toolResult);
                nextSpeakerName = currentAgent.name;
            }
            else if (responseTurn.target_type === "AGENT") {
                nextSpeakerName = responseTurn.recipient;
            }
            else {
                this.ui.displayError("無効なtarget_typeです。PMに制御を移します。");
                nextSpeakerName = "PM";
            }
        }
    }
    async _executeTool(toolName, toolArgs) {
        const tool = this.tools[toolName];
        if (!tool)
            return {
                tool_name: toolName,
                result: `エラー: ツール '${toolName}' が見つかりません。`,
                error: true,
            };
        try {
            const result = await tool.execute(toolArgs, this.workspace);
            return { tool_name: toolName, result, error: false };
        }
        catch (e) {
            return {
                tool_name: toolName,
                result: `エラー: ${e}`,
                error: true,
            };
        }
    }
    async _handleFinalizeRequirements(client, model_name) {
        this.ui.printHeader("Phase 2: チーム編成とキックオフ", "-");
        const pm = this.agents["PM"];
        if (!(pm instanceof PMAgent_1.PMAgent))
            throw new Error("PMAgentが見つかりません。");
        this.ui.displayStatus("🤔 PMがプロジェクト計画を策定中...");
        const plan = await pm.planProjectKickoff(this.logger, Object.values(this.agents));
        await this.workspace.saveArtifact(PLAN_FILE, JSON.stringify(plan, null, 2), META_DIR);
        this.ui.displayStatus(`✅ プロジェクト計画を '${PLAN_FILE}' に保存しました。`);
        for (const info of plan.team) {
            if (!this.agents[info.name]) {
                this.agents[info.name] = new AIAgent_1.AIAgent(client, info.name, info.role, info.project_role, model_name);
            }
        }
        this.ui.displayStatus("\n✅ 新しい開発チームが編成されました！");
        Object.values(this.agents).forEach((agent) => this.ui.displayStatus(` - ${agent.name} (${agent.role})`));
        const broadcastTurn = {
            sender: "PM",
            recipient: "ALL",
            message: plan.broadcast_message,
            thought: plan.thought,
            target_type: "AGENT",
            tool_args: {},
            special_action: "_",
        };
        await this.logger.log(broadcastTurn);
        this.ui.displayMessage(broadcastTurn);
        const firstDirectiveTurn = {
            sender: "PM",
            ...plan.first_directive,
            thought: "最初のタスク指示",
            target_type: "AGENT",
            tool_args: {},
            special_action: "_",
        };
        await this.logger.log(firstDirectiveTurn);
        this.ui.displayMessage(firstDirectiveTurn);
        return firstDirectiveTurn.recipient;
    }
}
exports.Orchestrator = Orchestrator;
