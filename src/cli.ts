#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { intro, isCancel, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { buildCommands } from "./commands/index.js";
import { printBanner, printCommandHeader } from "./utils/ui.js";
import { printHelp } from "./help.js";
import type { Command } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), { encoding: "utf8" }),
) as { version?: string };

const commands: Command[] = buildCommands(() => printHelp(commands));

function findCommand(name?: string): Command | undefined {
  if (!name) return undefined;
  return commands.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name),
  );
}

async function runInteractive(): Promise<void> {
  printBanner();
  intro(pc.inverse(" Interactive Mode "));
  
  const choice = await select({
    message: "What would you like to do?",
    options: commands
      .filter((cmd) => cmd.name !== "help")
      .map((cmd) => ({
        value: cmd.name,
        label: cmd.name,
        hint: cmd.description,
      })),
  });

  if (isCancel(choice)) {
    outro("Cancelled.");
    return;
  }

  const selected = findCommand(String(choice));
  if (!selected) {
    console.error("Selected command not found.");
    return;
  }

  await Promise.resolve(selected.run({ argv: [], root }));
  outro("Done.");
}

async function main(): Promise<void> {
  const [, , ...argvRaw] = process.argv;
  const interactiveFlag =
    argvRaw.includes("--interactive") || argvRaw.includes("-i");
  const argv = argvRaw.filter(
    (arg) => arg !== "--interactive" && arg !== "-i",
  );
  const [first, ...rest] = argv;

  if (interactiveFlag || !first) {
    await runInteractive();
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

  const cmd = findCommand(first);
  if (!cmd) {
    console.error(`Unknown command: ${first}`);
    printHelp(commands);
    process.exitCode = 1;
    return;
  }

  printCommandHeader(cmd.name, cmd.description);
  await Promise.resolve(cmd.run({ argv: rest, root }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
