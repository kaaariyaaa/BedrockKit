import { handleInit } from "./init.js";
import { handleTemplate } from "./template.js";
import { handleValidate } from "./validate.js";
import { handleConfig } from "./config.js";
import { handleBump } from "./bump.js";
import { handlePackage } from "./package.js";
import { handleBuild } from "./build.js";
import { handleDeps } from "./deps.js";
import { handleSync } from "./sync.js";
import { handleImport } from "./import.js";
import { handleWatch } from "./watch.js";
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
      name: "import",
      description: "Import existing mcpack/mcaddon/zip into a project workspace",
      run: handleImport,
    },

    {
      name: "validate",
      description: "Validate manifests, dependencies, and project structure",
      run: handleValidate,
    },
    {
      name: "build",
      description: "Build/compile packs using @minecraft/core-build-tasks",
      run: handleBuild,
    },
    {
      name: "package",
      description: "Package build artifacts into distributable archives (zip)",
      run: handlePackage,
    },
    {
      name: "deps",
      description: "Sync Script API npm dependencies into config/manifest",
      run: handleDeps,
    },
    {
      name: "sync",
      description: "Sync build outputs to local Minecraft developer folders",
      run: handleSync,
    },
    {
      name: "watch",
      description: "Watch projects, auto build (watch outDir) and sync on change",
      run: handleWatch,
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
