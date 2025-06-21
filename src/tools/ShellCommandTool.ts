import { ToolWithGenerics } from "./Tool";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs";
import * as fsp from "fs/promises";
import path from "path";

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
  private isShuttingDown = false;

  private readonly identityFilePath: string;
  private readonly containerName: string;
  private readonly committedImageName: string;

  private readonly commandTimeout: number;

  constructor(projectPath: string, commandTimeout: number = 30000) {
    super({
      description:
        "シェルコマンドを実行、または実行履歴を確認します。コマンドは現在の作業フォルダを/workspaceにマウントしたDockerコンテナの中で実行されます。コンテナのイメージは「ubuntu:latest」です。コンテナはセッション中維持され、プロセス終了時に状態が保存されます。",
      argsSchema: ShellCommandToolArgsSchema,
      returnSchema: ShellCommandToolReturnSchema,
    });
    const containerMetaPath = path.join(projectPath, "_meta", "container");
    this.tarballPath = path.join(containerMetaPath, "container_state.tar");
    this.logFilePath = path.join(containerMetaPath, "container_log.json");
    this.identityFilePath = path.join(
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

    this.registerShutdownHook();
  }

  // (以下、loadOrInitializeContainerIdentityから_createAndStartContainerまでは変更なし)

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

  private registerShutdownHook(): void {
    const shutdownHandler = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(
        "プロセス終了シグナルを検知しました。クリーンアップ処理を開始します..."
      );
      await this.shutdown();
      process.exit(0);
    };

    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);
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

      const { stdout: imageId } = await execAsync(
        `docker images -q ${this.committedImageName}`
      );
      if (imageId) {
        console.log(
          `残存イメージ ${this.committedImageName} が見つかりました。削除します。`
        );
        await execAsync(`docker rmi --force ${imageId.trim()}`);
      }
    } catch (error) {
      console.warn(
        `既存リソースのクリーンアップ中にエラーが発生しましたが、処理を続行します。`,
        error
      );
    }
  }

  omitArgs(args: ShellCommandToolArgs): ShellCommandToolArgs {
    return args;
  }

  omitResult(result: ShellCommandToolReturn): ShellCommandToolReturn {
    if (Array.isArray(result)) {
      return result.map((item) => {
        if (item.output.length > 500) {
          return {
            ...item,
            output: item.output.substring(0, 500) + "\n... (省略)",
          };
        }
        return item;
      });
    } else if (typeof result === "object" && "output" in result) {
      if (result.output.length > 2000) {
        return {
          ...result,
          output:
            result.output.substring(0, 2000) + "\n... (結果が長すぎるため省略)",
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

  private async _createAndStartContainer(): Promise<void> {
    if (this.containerId) return;

    if (!this.historyLoaded) await this._loadHistory();

    const dockerRunOptions = [
      "-d",
      `--name ${this.containerName}`,
      `-v ${this.hostWorkspacePath}:/workspace`,
      `-w /workspace`,
      "--entrypoint tail",
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
          `docker run ${dockerRunOptions} ${this.committedImageName} -f /dev/null`
        );
        this.containerId = newContainerId.trim();
        console.log(`コンテナが復元・起動されました。ID: ${this.containerId}`);
        return;
      } catch (error) {
        console.warn(
          `tarファイルからのコンテナ復元に失敗しました。新しいコンテナを作成します。`,
          error
        );
        await execAsync(`docker rm --force ${this.containerName}`).catch(
          () => {}
        );
        await execAsync(`docker rmi --force ${this.committedImageName}`).catch(
          () => {}
        );
      }
    }

    try {
      console.log(
        `基本イメージ'ubuntu:latest'からコンテナを新規に作成・起動します...`
      );
      const { stdout: newContainerId } = await execAsync(
        `docker run ${dockerRunOptions} ubuntu:latest -f /dev/null`
      );
      this.containerId = newContainerId.trim();
      console.log(`コンテナが新規に作成されました。ID: ${this.containerId}`);
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
      console.warn(
        "クリーンアップ対象のコンテナIDがありません。処理をスキップします。"
      );
      return;
    }
    const tempContainerId = this.containerId;
    this.containerId = null;
    try {
      console.log(
        `コンテナ'${tempContainerId}'の状態をイメージ'${this.committedImageName}'にコミットします...`
      );
      await execAsync(
        `docker commit ${tempContainerId} ${this.committedImageName}`
      );
      console.log(`イメージを'${this.tarballPath}'に保存します...`);
      await fsp.mkdir(path.dirname(this.tarballPath), { recursive: true });
      await execAsync(
        `docker save -o ${this.tarballPath} ${this.committedImageName}`
      );
      console.log(`コンテナの状態は正常に保存されました。`);
    } catch (error) {
      console.error(`コンテナの状態保存中にエラーが発生しました。`, error);
    } finally {
      try {
        console.log(`コンテナ'${tempContainerId}'を停止・削除しています...`);
        await execAsync(`docker rm --force ${tempContainerId}`);
        console.log(`コンテナは正常に削除されました。`);
      } catch (error) {
        console.warn(`コンテナの削除中に警告が発生しました。`, error);
      }
      try {
        console.log(
          `中間イメージ'${this.committedImageName}'を削除しています...`
        );
        await execAsync(`docker rmi ${this.committedImageName}`);
        console.log(`中間イメージは正常に削除されました。`);
      } catch (error) {
        console.warn(`中間イメージの削除中に警告が発生しました。`, error);
      }
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

      // タイムアウト以外の通常のエラー処理
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
    return result;
  }
}
