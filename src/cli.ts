#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { intro, isCancel, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { buildCommands } from "./commands/index.js";
import { printBanner, printCommandHeader } from "./utils/ui.js";
import { printHelp } from "./help.js";
import type { Command, Lang } from "./types.js";
import { resolveLang, t } from "./utils/i18n.js";
import { ensureSettings, loadSettings } from "./utils/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), { encoding: "utf8" }),
) as { version?: string };

function findCommand(name: string | undefined, commands: Command[]): Command | undefined {
  if (!name) return undefined;
  return commands.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name),
  );
}

function extractLang(argv: string[]): string | undefined {
  const eq = argv.find((a) => a.startsWith("--lang="));
  if (eq) return eq.split("=", 2)[1];
  const idx = argv.findIndex((a) => a === "--lang" || a === "-l");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

function stripLang(argv: string[]): { args: string[]; langInput?: string } {
  const args: string[] = [];
  let langInput: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--lang" || arg === "-l") {
      langInput = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--lang=")) {
      langInput = arg.split("=", 2)[1];
      continue;
    }
    args.push(arg);
  }
  return { args, langInput };
}

async function runInteractive(commands: Command[], lang: Lang): Promise<void> {
  printBanner();
  intro(pc.inverse(" Interactive Mode "));
  
  const choice = await select({
    message: t("cli.menuPrompt", lang),
    options: commands
      .filter((cmd) => cmd.name !== "help")
      .map((cmd) => ({
        value: cmd.name,
        label: cmd.name,
        hint: cmd.description,
      })),
  });

  if (isCancel(choice)) {
    outro(t("common.cancelled", lang));
    return;
  }

  const selected = findCommand(String(choice), commands);
  if (!selected) {
    console.error(t("cli.menuNotFound", lang));
    return;
  }

  await Promise.resolve(selected.run({ argv: [], root, lang }));
  outro(t("common.done", lang));
}

async function main(): Promise<void> {
  const [, , ...argvRaw] = process.argv;
  const { args: argvNoLang, langInput } = stripLang(argvRaw);
  const langFlag = langInput ?? extractLang(argvRaw);
  let settings = await loadSettings();
  if (!settings.initialized) {
    try {
      settings = await ensureSettings(langFlag);
    } catch (err) {
      process.exitCode = 1;
      return;
    }
  }
  const lang = resolveLang(langFlag, settings.lang);
  const interactiveFlag =
    argvNoLang.includes("--interactive") || argvNoLang.includes("-i");
  const argv = argvNoLang.filter(
    (arg) => arg !== "--interactive" && arg !== "-i",
  );
  const [first, ...rest] = argv;

  const commands: Command[] = buildCommands(lang, () => printHelp(commands));

  if (interactiveFlag || !first) {
    await runInteractive(commands, lang);
    return;
  }

  if (first === "-h" || first === "--help") {
    printHelp(commands);
    return;
  }

  if (first === "-v" || first === "--version") {
    console.log(pkg.version ?? "0.0.0");
    return;
  }

  const cmd = findCommand(first, commands);
  if (!cmd) {
    console.error(`Unknown command: ${first}`);
    printHelp(commands);
    process.exitCode = 1;
    return;
  }

  printCommandHeader(cmd.name, cmd.description);
  await Promise.resolve(cmd.run({ argv: rest, root, lang }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
