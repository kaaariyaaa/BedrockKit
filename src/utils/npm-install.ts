import { exec, spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

type InstallOpts = {
  cmd?: string;
  args?: string[];
  shell?: boolean;
  /** タイムアウト（ミリ秒）。デフォルト: 120000 (2分) */
  timeoutMs?: number;
};

/**
 * npm install を実行する。
 * Windows 環境では exec を使用してより確実にプロセス終了を検出する。
 */
export async function runInstallCommand(
  cwd: string,
  packages: string[] = [],
  opts: InstallOpts = {},
): Promise<void> {
  const isWin = platform() === "win32";
  const cmd = opts.cmd ?? "npm";
  // --no-progress: 進捗表示を無効化（Windows で stdout がブロックする問題を回避）
  // --loglevel=error: 不要な警告を抑制
  const baseArgs =
    opts.args ??
    (packages.length
      ? ["install", "--no-progress", "--loglevel=error", ...packages]
      : ["ci", "--no-progress", "--loglevel=error"]);
  const timeoutMs = opts.timeoutMs ?? 120_000; // デフォルト2分

  const attempts: { args: string[]; useExec: boolean; reason?: string }[] = [];

  // Windows では exec を優先（プロセス終了検出がより確実）
  if (isWin) {
    attempts.push({
      args: baseArgs,
      useExec: true,
      reason: undefined,
    });
  } else {
    attempts.push({
      args: baseArgs,
      useExec: false,
      reason: undefined,
    });
  }

  // npm ci が失敗した場合のフォールバックとして npm install を追加（packages が空のときのみ）
  if (!packages.length && baseArgs[0] === "ci") {
    attempts.push({
      args: ["install", "--no-progress", "--loglevel=error"],
      useExec: isWin,
      reason: "npm ci failed, retrying with npm install",
    });
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      if (attempt.reason) {
        console.warn(`${attempt.reason}`);
      }

      if (attempt.useExec) {
        // exec を使用（Windows でより確実）
        await runWithExec(cmd, attempt.args, cwd, timeoutMs);
      } else {
        // spawn を使用（Unix 系）
        await runWithSpawn(cmd, attempt.args, cwd, timeoutMs);
      }
      return;
    } catch (err) {
      lastErr = err;
      // タイムアウトエラーの場合はリトライせず即座にスロー
      if (err instanceof Error && err.message.includes("timed out")) {
        throw err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * exec を使用してコマンドを実行（Windows 向け）
 * exec は shell を内部で使用し、コマンド完了時に確実に Promise が解決される
 */
async function runWithExec(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<void> {
  const fullCmd = `${cmd} ${args.join(" ")}`;

  try {
    const { stdout, stderr } = await execAsync(fullCmd, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      windowsHide: true,
    });

    // 出力を表示
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (err: unknown) {
    // exec のエラーオブジェクトには stdout/stderr が含まれる
    const execErr = err as { stdout?: string; stderr?: string; killed?: boolean; code?: number };

    if (execErr.stdout) process.stdout.write(execErr.stdout);
    if (execErr.stderr) process.stderr.write(execErr.stderr);

    if (execErr.killed) {
      throw new Error(`${fullCmd} timed out after ${timeoutMs}ms`);
    }
    if (execErr.code !== undefined && execErr.code !== 0) {
      throw new Error(`${fullCmd} exited with code ${execErr.code}`);
    }
    throw err;
  }
}

/**
 * spawn を使用してコマンドを実行（Unix 系向け）
 */
function runWithSpawn(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        fn();
      }
    };

    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    timeoutId = setTimeout(() => {
      settle(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // 既に終了している場合は無視
        }
        reject(new Error(`${cmd} ${args.join(" ")} timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    child.on("error", (err) => {
      settle(() => reject(err));
    });

    child.on("exit", (code, signal) => {
      settle(() => {
        if (code === 0) {
          resolve();
        } else if (signal) {
          reject(new Error(`${cmd} ${args.join(" ")} was killed by signal ${signal}`));
        } else {
          reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
        }
      });
    });
  });
}
