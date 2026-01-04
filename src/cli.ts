#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  intro,
  isCancel,
  outro,
  select,
  text,
  confirm,
  spinner,
} from "@clack/prompts";

type CommandContext = {
  argv: string[];
  root: string;
};

type Command = {
  name: string;
  aliases?: string[];
  description: string;
  run: (ctx: CommandContext) => void | Promise<void>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), { encoding: "utf8" }),
) as { version?: string };

const knownTemplates = [
  { value: "official-sample", label: "Official sample", hint: "Mojang sample packs" },
  { value: "bkit-default", label: "BedrockKit default", hint: "Built-in starter template" },
  { value: "custom-git", label: "Custom Git URL", hint: "Provide your own repository" },
];

const commands: Command[] = [
  {
    name: "init",
    aliases: ["new"],
    description:
      "Initialize a new Bedrock addon/resource pack workspace from a template",
    run: async (ctx) => {
      await handleInit(ctx);
    },
  },
  {
    name: "template",
    description: "Manage templates (list/add/rm) for project scaffolding",
    run: async (ctx) => {
      await handleTemplate(ctx);
    },
  },
  {
    name: "bump",
    description: "Bump version and regenerate manifest/version metadata",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const level = parsed.positional[0] ?? "patch";
      console.log(`[bump] Simulating version bump: ${level}`);
      console.log(
        "Would update: manifests (header/modules), config, lockfiles as needed.",
      );
    },
  },
  {
    name: "validate",
    description: "Validate manifests, dependencies, and project structure",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const strict = !!parsed.flags.strict;
      console.log("[validate] Running static checks%s", strict ? " (strict)" : "");
      console.log("- manifest schema");
      console.log("- dependency linkage");
      console.log("- uuid collisions");
    },
  },
  {
    name: "build",
    description: "Build/compile packs using @minecraft/core-build-tasks",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const target = parsed.flags.target ?? "dev";
      console.log(`[build] Building target '${target}' (stub)`);
    },
  },
  {
    name: "package",
    description: "Package build artifacts into distributable archives (zip)",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const out = parsed.flags.out ?? "dist/";
      console.log(`[package] Would zip build artifacts to ${out}`);
    },
  },
  {
    name: "sync",
    description: "Sync build outputs to local Minecraft developer folders",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const target = parsed.flags.target ?? "dev";
      const dry = !!parsed.flags["dry-run"];
      console.log(
        `[sync] Would copy build output to '${target}'${dry ? " (dry-run)" : ""}`,
      );
    },
  },
  {
    name: "config",
    description: "Manage and inspect bkit configuration",
    run: async (ctx) => {
      const parsed = parseArgs(ctx.argv);
      const inspect = parsed.flags.show ?? "all";
      console.log(`[config] Inspecting config scope: ${inspect}`);
    },
  },
  {
    name: "help",
    description: "Show help",
    run: () => {
      printHelp();
    },
  },
];

function printHelp(): void {
  const lines = [
    "BedrockKit CLI",
    "",
    "Usage:",
    "  bkit <command> [...args]",
    "  bkit -i|--interactive",
    "",
    "Commands:",
    ...commands.map((cmd) => {
      const alias = cmd.aliases?.length ? ` (${cmd.aliases.join(", ")})` : "";
      return `  ${cmd.name}${alias.padEnd(12 - cmd.name.length)} ${cmd.description}`;
    }),
    "",
    "Flags:",
    "  -h, --help       Show help",
    "  -v, --version    Show version",
    "  -i, --interactive Launch arrow-key menu",
  ];
  console.log(lines.join("\n"));
}

function findCommand(name?: string): Command | undefined {
  if (!name) return undefined;
  return commands.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name),
  );
}

type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const [key, maybeValue] = arg.slice(2).split("=");
      if (maybeValue !== undefined) {
        flags[key] = maybeValue;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
      continue;
    }
    if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags };
}

async function handleInit(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const projectName =
    (parsed.flags.name as string | undefined) ?? parsed.positional[0];
  const templateArg = parsed.flags.template as string | undefined;
  const nonInteractive = !!parsed.flags.yes;

  if (!projectName && !nonInteractive) {
    const nameInput = await text({
      message: "Project name",
      initialValue: "bedrock-addon",
      validate: (value) =>
        value.trim().length === 0 ? "Project name is required" : undefined,
    });
    if (isCancel(nameInput)) {
      outro("Cancelled.");
      return;
    }
    parsed.positional[0] = String(nameInput);
  }

  let template = templateArg;
  if (!template && !nonInteractive) {
    const choice = await select({
      message: "Choose a template",
      options: knownTemplates,
    });
    if (isCancel(choice)) {
      outro("Cancelled.");
      return;
    }
    template = String(choice);
  }

  intro("Initializing workspace");
  const spin = spinner();
  spin.start("Preparing files");
  await new Promise((res) => setTimeout(res, 200));
  spin.stop("Preparation complete (stub)");

  console.log(
    "[init] Would scaffold project '%s' from template '%s'",
    projectName ?? "<unnamed>",
    template ?? "bkit-default",
  );
  console.log(
    "- Generate manifests, UUIDs, config files, and link packs per requirements.",
  );
}

async function handleTemplate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const [sub] = parsed.positional;
  if (!sub || sub === "list") {
    console.log("[template] Known templates:");
    knownTemplates.forEach((t) =>
      console.log(`- ${t.value.padEnd(16)} ${t.label} (${t.hint})`),
    );
    return;
  }

  if (sub === "add") {
    const name = parsed.positional[1];
    const url = parsed.positional[2] ?? (parsed.flags.url as string | undefined);
    if (!name || !url) {
      console.error("Usage: template add <name> <git-url>");
      process.exitCode = 1;
      return;
    }
    console.log(`[template] Would register template '${name}' from ${url}`);
    return;
  }

  if (sub === "rm" || sub === "remove") {
    const name = parsed.positional[1];
    if (!name) {
      console.error("Usage: template rm <name>");
      process.exitCode = 1;
      return;
    }
    const ok = await confirm({
      message: `Remove template '${name}'?`,
      initialValue: false,
    });
    if (isCancel(ok) || !ok) {
      console.log("Aborted.");
      return;
    }
    console.log(`[template] Would remove template '${name}'`);
    return;
  }

  console.error(`Unknown template subcommand: ${sub}`);
  process.exitCode = 1;
}

async function runInteractive(): Promise<void> {
  intro(`BedrockKit CLI${pkg.version ? ` v${pkg.version}` : ""}`);
  const choice = await select({
    message: "Select a command to run",
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
    printHelp();
    return;
  }

  if (first === "-v" || first === "--version") {
    console.log(pkg.version ?? "0.0.0");
    return;
  }

  const cmd = findCommand(first);
  if (!cmd) {
    console.error(`Unknown command: ${first}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  await Promise.resolve(cmd.run({ argv: rest, root }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
