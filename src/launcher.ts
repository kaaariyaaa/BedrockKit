#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

type SpawnCandidate = {
  cmd: string;
  useShell: boolean;
};

function isWindows(): boolean {
  return process.platform === "win32";
}

function detectCandidates(): SpawnCandidate[] {
  if (isWindows()) {
    return [
      { cmd: "bun.exe", useShell: false },
      { cmd: "bun.cmd", useShell: true },
      { cmd: "bun", useShell: true },
    ];
  }
  return [{ cmd: "bun", useShell: false }];
}

function resolveBunExecutable(): SpawnCandidate | null {
  for (const candidate of detectCandidates()) {
    const res = spawnSync(candidate.cmd, ["--version"], {
      stdio: "ignore",
      shell: candidate.useShell,
    });
    if (res.status === 0) {
      return candidate;
    }
  }
  return null;
}

function main(): void {
  const bun = resolveBunExecutable();
  if (!bun) {
    const hint = isWindows()
      ? "Install Bun and ensure bun.exe is available in PATH."
      : "Install Bun and ensure it is available in PATH.";
    console.error("[bkit] Bun runtime not found. " + hint);
    process.exitCode = 1;
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cliPath = resolve(__dirname, "cli.js");
  const args = [cliPath, ...process.argv.slice(2)];

  const res = spawnSync(bun.cmd, args, {
    stdio: "inherit",
    shell: bun.useShell,
  });

  if (res.error) {
    console.error(res.error);
    process.exitCode = 1;
    return;
  }
  if (typeof res.status === "number") {
    process.exitCode = res.status;
  }
}

main();
