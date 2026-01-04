import { handleInit } from "./init.js";
import { handleTemplate } from "./template.js";
import { handleValidate } from "./validate.js";
import { handleConfig } from "./config.js";
import { handleBump } from "./bump.js";
import type { Command } from "../types.js";
import { parseArgs } from "../utils/args.js";

export function buildCommands(onHelp: () => void): Command[] {
  return [
    {
      name: "init",
      aliases: ["new"],
      description:
        "Initialize a new Bedrock addon/resource pack workspace from a template",
      run: handleInit,
    },
    {
      name: "bump",
      description: "Bump version and regenerate manifest/version metadata",
      run: handleBump,
    },
    {
      name: "template",
      description: "Manage templates (list/add/rm) for project scaffolding",
      run: handleTemplate,
    },

    {
      name: "validate",
      description: "Validate manifests, dependencies, and project structure",
      run: handleValidate,
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
      run: handleConfig,
    },
    {
      name: "help",
      description: "Show help",
      run: onHelp,
    },
  ];
}
