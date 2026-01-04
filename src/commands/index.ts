import { handleInit } from "./init.js";
import { handleTemplate } from "./template.js";
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
      name: "template",
      description: "Manage templates (list/add/rm) for project scaffolding",
      run: handleTemplate,
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
      run: onHelp,
    },
  ];
}
