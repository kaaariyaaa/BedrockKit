#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveLang, t } from "./utils/i18n.js";
import type { Lang } from "./types.js";

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

function resolveFromPathProbe(): SpawnCandidate | null {
  if (isWindows()) {
    const probe = spawnSync("where.exe", ["bun"], { stdio: "pipe" });
    if (probe.status !== 0) return null;
    const out = String(probe.stdout ?? "").trim();
    const first = out.split(/\r?\n/)[0];
    if (!first) return null;
    return { cmd: first, useShell: false };
  }
  const probe = spawnSync("which", ["bun"], { stdio: "pipe" });
  if (probe.status !== 0) return null;
  const out = String(probe.stdout ?? "").trim();
  if (!out) return null;
  return { cmd: out, useShell: false };
}


function getLang(): Lang {
  return resolveLang();
}

async function main(): Promise<void> {
  const lang = getLang();
  let bun = resolveBunExecutable();
  if (!bun) {
    bun = resolveFromPathProbe();
  }
  if (!bun) {
    console.error(t("launcher.bunMissing", lang));
    console.error(
      t("launcher.bunInstallGuide", lang, {
        url: "https://bun.com/docs/installation",
      }),
    );
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

void main();
