import { ToolWithGenerics } from "./Tool";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs";
import * as fsp from "fs/promises";
import path from "path";
import { Workspace } from "../core/Workspace";

const execAsync = promisify(exec);

const ALLOWED_DOCKER_EXEC_OPTIONS = ["--workdir", "--env", "--detach"] as const;

const DockerExecOptionSchema = z.object({
  option: z
    .enum(ALLOWED_DOCKER_EXEC_OPTIONS)
    .optional()
    .describe(
      "Docker execのオプション名。Webサーバーの起動など、バックグラウンドで起動させたいコマンドには--detachを指定して下さい。"
    ),
  value: z
    .string()
    .optional()
    .describe("オプションの値。例: '/tmp', 'MY_VAR=value'"),
});

const CommandResultSchema = z.object({
  command: z.string().describe("実行されたシェルコマンド。"),
  exitCode: z.number().describe("コマンドの終了コード。"),
  output: z.string().describe("コマンドの標準出力および標準エラー出力。"),
});
type CommandHistoryItem = z.infer<typeof CommandResultSchema>;

const ShellCommandToolArgsSchema = z.object({
  mode: z
    .enum(["HISTORY", "EXECUTE"])
    .describe("実行モード。'EXECUTE'でコマンド実行、'HISTORY'で履歴確認。"),
  command: z
    .string()
    .optional()
    .describe(
      "Dockerコンテナ内で実行したいシェルコマンド。'HISTORY'の場合は設定不要"
    ),
  dockerExecOptions: z
    .array(DockerExecOptionSchema)
    .optional()
    .describe(
      "docker execに渡す追加のオプション。'EXECUTE'の場合で、必要な場合のみ設定する。（サーバーを起動する際にdetachを指定するなど。）"
    ),
});
type ShellCommandToolArgs = z.infer<typeof ShellCommandToolArgsSchema>;

const ShellCommandToolReturnSchema = z.union([
  CommandResultSchema.describe("コマンドの実行結果。"),
  z.array(CommandResultSchema).describe("コマンドの実行履歴のリスト。"),
]);
type ShellCommandToolReturn = z.infer<typeof ShellCommandToolReturnSchema>;

const ContainerIdentitySchema = z.object({
  containerName: z.string().describe("コンテナ名"),
  committedImageName: z.string().describe("コンテナのイメージ名"),
});

type ContainerIdentity = z.infer<typeof ContainerIdentitySchema>;

export class ShellCommandTool extends ToolWithGenerics<
  ShellCommandToolArgs,
  ShellCommandToolReturn
> {
  private containerId: string | null = null;
  private readonly tarballPath: string;
  private readonly logFilePath: string;
  private readonly hostWorkspacePath: string;
  private commandHistory: CommandHistoryItem[] = [];
  private historyLoaded = false;

  private readonly identityFilePath: string;
  private readonly containerName: string;
  private readonly committedImageName: string;

  private readonly commandTimeout: number;

  private readonly dockerfilePath: string = Workspace.getResolvePathSafe(
    "src/tools/ShellCommandTool"
  );
  private baseImageName: string = "docker:dind"; // デフォルトのベースイメージ

  constructor(projectPath: string, commandTimeout: number = 30000) {
    super({
      description:
        "シェルコマンドを実行、または実行履歴を確認します。コマンドは現在の作業フォルダを/workspaceにマウントしたDockerコンテナの中で実行されます。コンテナのイメージは「docker:dind」で、Alpine Linuxがベースです。",
      argsSchema: ShellCommandToolArgsSchema,
      returnSchema: ShellCommandToolReturnSchema,
    });
    const containerMetaPath = Workspace.getResolvePathSafe(
      projectPath,
      "_meta",
      "container"
    );
    this.tarballPath = Workspace.getResolvePathSafe(
      containerMetaPath,
      "container_state.tar"
    );
    this.logFilePath = Workspace.getResolvePathSafe(
      containerMetaPath,
      "container_log.json"
    );
    this.identityFilePath = Workspace.getResolvePathSafe(
      containerMetaPath,
      "container_identity.json"
    );
    this.hostWorkspacePath = projectPath;
    this.commandTimeout = commandTimeout;

    const identity = this.loadOrInitializeContainerIdentity();
    this.containerName = identity.containerName;
    this.committedImageName = identity.committedImageName;

    this.cleanupLingeringResources().catch((err) => {
      console.error(
        "起動時のリソースクリーンアップ中にエラーが発生しました。",
        err
      );
    });
  }

  private loadOrInitializeContainerIdentity(): ContainerIdentity {
    try {
      if (fs.existsSync(this.identityFilePath)) {
        console.log(
          `既存のコンテナ設定ファイル'${this.identityFilePath}'を読み込みます。`
        );
        const fileContent = fs.readFileSync(this.identityFilePath, "utf-8");
        const identity = ContainerIdentitySchema.parse(JSON.parse(fileContent));
        if (identity.containerName && identity.committedImageName) {
          return identity;
        }
        console.warn(
          "コンテナ設定ファイルの内容が不正です。新しいIDを作成します。"
        );
      }
    } catch (error) {
      console.warn(
        `コンテナ設定ファイルの読み込みに失敗しました。新しいIDを作成します。`,
        error
      );
    }

    console.log(
      `新しいコンテナIDを作成し、'${this.identityFilePath}'に保存します。`
    );
    const newName = `ai-agent-shell-${crypto.randomBytes(8).toString("hex")}`;
    const newIdentity: ContainerIdentity = {
      containerName: newName,
      committedImageName: `${newName}:latest`,
    };

    try {
      fs.mkdirSync(path.dirname(this.identityFilePath), {
        recursive: true,
      });
      fs.writeFileSync(
        this.identityFilePath,
        JSON.stringify(newIdentity, null, 2)
      );
    } catch (error) {
      console.error(`コンテナ設定ファイルの保存に失敗しました。`, error);
      throw new Error("コンテナ設定ファイルの保存に失敗しました。");
    }
    return newIdentity;
  }

  private async cleanupLingeringResources(): Promise<void> {
    try {
      console.log(
        `前回実行時の残存リソース '${this.containerName}' がないか確認し、あれば削除します...`
      );
      const { stdout: containerId } = await execAsync(
        `docker ps -a -q --filter "name=^/${this.containerName}$"`
      );
      if (containerId) {
        console.log(
          `残存コンテナ ${containerId.trim()} が見つかりました。強制的に削除します。`
        );
        await execAsync(`docker rm --force ${containerId.trim()}`);
      }
    } catch (error) {
      console.warn(
        `既存リソースのクリーンアップ中にエラーが発生しましたが、処理を続行します。`,
        error
      );
    }
  }

  omitArgs(
    passedTurns: number,
    args: ShellCommandToolArgs
  ): ShellCommandToolArgs {
    return args;
  }

  omitResult(
    passedTurns: number,
    result: ShellCommandToolReturn
  ): ShellCommandToolReturn {
    if (Array.isArray(result)) {
      return result.map((item) => {
        if (item.output.length > 200) {
          if (passedTurns > 10)
            return {
              ...item,
              output: "(省略)",
            };
          return {
            ...item,
            output:
              item.output.substring(0, 100) +
              "\n... (省略) ...\n" +
              item.output.substring(item.output.length - 100),
          };
        }
        return item;
      });
    } else if (typeof result === "object" && "output" in result) {
      if (result.output.length > 800) {
        if (passedTurns > 10)
          return {
            ...result,
            output: "(省略)",
          };
        return {
          ...result,
          output:
            result.output.substring(0, 400) +
            "\n... (結果が長すぎるため省略) ...\n" +
            result.output.substring(result.output.length - 400),
        };
      }
    }
    return result;
  }

  private async _loadHistory(): Promise<void> {
    if (fs.existsSync(this.logFilePath)) {
      try {
        console.log(`履歴ファイル '${this.logFilePath}' を読み込んでいます...`);
        const data = await fsp.readFile(this.logFilePath, "utf-8");
        if (data) {
          this.commandHistory = z
            .array(CommandResultSchema)
            .parse(JSON.parse(data));
          console.log(`履歴の読み込みが完了しました。`);
        }
      } catch (error) {
        console.warn(
          `履歴ファイル '${this.logFilePath}' の読み込みまたはパースに失敗しました。`,
          error
        );
        this.commandHistory = [];
      }
    }
    this.historyLoaded = true;
  }

  private async _saveHistory(): Promise<void> {
    try {
      await fsp.mkdir(path.dirname(this.logFilePath), { recursive: true });
      await fsp.writeFile(
        this.logFilePath,
        JSON.stringify(this.commandHistory, null, 2)
      );
    } catch (error) {
      console.error(
        `履歴ファイル'${this.logFilePath}'の保存中にエラーが発生しました。`,
        error
      );
    }
  }

  private async _saveContainerState(): Promise<void> {
    if (!this.containerId) {
      console.warn(
        "コンテナIDが存在しないため、コンテナの状態を保存できません。"
      );
      return;
    }
    try {
      console.log(`現在のコンテナの状態を保存しています...`);

      await execAsync(`docker rmi --force ${this.committedImageName}`).catch(
        () => {}
      );

      console.log(
        `コンテナ'${this.containerId}'をイメージ'${this.committedImageName}'にコミットします...`
      );
      await execAsync(
        `docker commit ${this.containerId} ${this.committedImageName}`
      );

      console.log(`イメージを'${this.tarballPath}'に保存します...`);
      await fsp.mkdir(path.dirname(this.tarballPath), { recursive: true });
      await execAsync(
        `docker save -o ${this.tarballPath} ${this.committedImageName}`
      );

      console.log(`コンテナの状態が正常に保存されました。`);
    } catch (error) {
      console.error(`コンテナの状態保存中にエラーが発生しました。`, error);
    }
  }

  /**
   * Dockerfileが存在する場合、テンプレートイメージをビルドまたは準備します。
   */
  private async _prepareBaseImage(): Promise<void> {
    const dockerfileName = Workspace.getResolvePathSafe(
      this.dockerfilePath,
      "Dockerfile"
    );
    if (!fs.existsSync(dockerfileName)) {
      console.log(
        `Dockerfileが見つかりません。デフォルトの'${this.baseImageName}'イメージを使用します。`
      );
      return;
    }

    try {
      const fileBuffer = await fsp.readFile(dockerfileName);
      const hashSum = crypto.createHash("sha256");
      hashSum.update(fileBuffer);
      const dockerfileHash = hashSum.digest("hex").substring(0, 16);
      const templateImageName = `ai-agent-base:${dockerfileHash}`;

      console.log(
        `Dockerfileを検出しました。テンプレートイメージ名: ${templateImageName}`
      );

      const { stdout: imageId } = await execAsync(
        `docker images -q ${templateImageName}`
      );

      if (imageId) {
        console.log(
          `既存のテンプレートイメージ'${templateImageName}'を使用します。`
        );
        this.baseImageName = templateImageName;
      } else {
        console.log(
          `テンプレートイメージ'${templateImageName}'をビルドします...`
        );
        await execAsync(
          `docker build -t ${templateImageName} ${this.dockerfilePath}`
        );
        console.log(`テンプレートイメージのビルドが完了しました。`);
        this.baseImageName = templateImageName;
      }
    } catch (error) {
      console.error(
        `Dockerfileからのイメージビルドに失敗しました。デフォルトの'docker:dind'イメージにフォールバックします。`,
        error
      );
      this.baseImageName = "docker:dind";
    }
  }

  private async _createAndStartContainer(): Promise<void> {
    if (this.containerId) return;
    if (!this.historyLoaded) await this._loadHistory();

    const dockerRunOptions = [
      `-it`,
      `-d`,
      `--name ${this.containerName}`,
      `-v ${this.hostWorkspacePath}:/workspace`,
      `-w /workspace`,
      `--privileged`,
    ].join(" ");

    if (fs.existsSync(this.tarballPath)) {
      try {
        console.log(
          `保存されたファイル'${this.tarballPath}'からイメージをロードしています...`
        );
        await execAsync(`docker load -i ${this.tarballPath}`);
        console.log(
          `ロードしたイメージ'${this.committedImageName}'からコンテナを作成・起動します...`
        );
        const { stdout: newContainerId } = await execAsync(
          `docker run ${dockerRunOptions} ${this.committedImageName}`
        );
        this.containerId = newContainerId.trim();
        console.log(`コンテナが復元・起動されました。ID: ${this.containerId}`);

        // コンテナ内のDockerが起動していない可能性があるため
        await new Promise((res) => setTimeout(res, 3000));
        return;
      } catch (error) {
        console.warn(
          `tarファイルからのコンテナ復元に失敗しました。新しいコンテナを作成します。`,
          error
        );
        await this.shutdown().catch(() => {});
        await execAsync(`docker rmi --force ${this.committedImageName}`).catch(
          () => {}
        );
      }
    }

    // 新規コンテナ作成のロジック
    await this._prepareBaseImage();

    try {
      console.log(
        `ベースイメージ'${this.baseImageName}'からコンテナを新規に作成・起動します...`
      );
      const { stdout: newContainerId } = await execAsync(
        `docker run ${dockerRunOptions} ${this.baseImageName}`
      );
      this.containerId = newContainerId.trim();
      console.log(`コンテナが新規に作成されました。ID: ${this.containerId}`);

      // コンテナ内のDockerが起動していない可能性があるため
      await new Promise((res) => setTimeout(res, 3000));
    } catch (error) {
      console.error(`Dockerコンテナの作成に失敗しました。`, error);
      throw new Error(
        `Dockerコンテナの作成に失敗しました。Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public async shutdown(): Promise<void> {
    console.log(`シャットダウン処理を実行します...`);
    if (!this.containerId) {
      console.log(
        "クリーンアップ対象のコンテナIDがありません。処理をスキップします。"
      );
      return;
    }
    const tempContainerId = this.containerId;
    this.containerId = null;
    try {
      console.log(`コンテナ'${tempContainerId}'を停止・削除しています...`);
      await execAsync(`docker rm --force ${tempContainerId}`);
      console.log(`コンテナは正常に削除されました。`);
    } catch (error) {
      console.warn(`コンテナの削除中にエラーが発生しました。`, error);
    }
  }

  protected async _executeTool(
    args: ShellCommandToolArgs
  ): Promise<ShellCommandToolReturn> {
    if (args.mode === "HISTORY") {
      if (!this.historyLoaded) await this._loadHistory();
      return [...this.commandHistory];
    }
    if (!args.command || args.command.trim() === "") {
      throw new Error(
        "実行するコマンドが空です。'EXECUTE'モードでは`command`を指定する必要があります。"
      );
    }
    if (!this.containerId) await this._createAndStartContainer();
    if (!this.containerId) throw new Error("コンテナの起動に失敗しました。");

    const commandToExecute = args.command;
    const execOptionsString = (args.dockerExecOptions || [])
      .map(
        (opt) =>
          `${opt.option}${
            opt.value ? ` '${opt.value.replace(/'/g, "'\\''")}'` : ""
          }`
      )
      .join(" ");
    const escapedCommand = commandToExecute.replace(/'/g, "'\\''");
    const dockerCommand = `docker exec ${execOptionsString} ${this.containerId} sh -c '${escapedCommand}'`;

    let result: CommandHistoryItem;

    try {
      console.log(`コマンドを実行します: ${dockerCommand}`);

      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: this.commandTimeout,
      });

      const combinedOutput =
        (stdout ? `STDOUT:\n${stdout}` : "") +
        (stderr ? `\nSTDERR:\n${stderr}` : "");
      result = {
        command: commandToExecute,
        exitCode: 0,
        output: combinedOutput.trim(),
      };
    } catch (error: any) {
      if (error.timedOut) {
        const timeoutSeconds = this.commandTimeout / 1000;
        throw new Error(
          `コマンドの実行がタイムアウトしました（${timeoutSeconds}秒）。\n長時間実行されるプロセス（Webサーバーの起動など）を開始する場合は、dockerExecOptionsで '--detach' を指定してください。`
        );
      }

      const exitCode = typeof error.code === "number" ? error.code : 1;
      const combinedOutput =
        (error.stdout ? `STDOUT:\n${error.stdout}` : "") +
        (error.stderr ? `\nSTDERR:\n${error.stderr}` : "");
      result = {
        command: commandToExecute,
        exitCode: exitCode,
        output: `コマンド実行に失敗しました。Exit Code: ${exitCode}\n${combinedOutput.trim()}`,
      };
    }

    this.commandHistory.push(result);
    await this._saveHistory();

    if (result.exitCode === 0) {
      await this._saveContainerState();
    } else {
      console.warn(
        `コマンドが失敗したため(Exit Code: ${result.exitCode})、コンテナの状態は保存されませんでした。`
      );
    }

    return result;
  }
}
