import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BkitConfig } from "./types.js";
import { pathExists } from "./utils/fs.js";

export const defaultConfigPath = resolve(process.cwd(), "bkit.config.json");

export async function loadConfig(path: string = defaultConfigPath): Promise<BkitConfig> {
  if (!(await pathExists(path))) {
    throw new Error(`Config not found at ${path}`);
  }
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as BkitConfig;
}

export function validateConfig(config: BkitConfig): string[] {
  const issues: string[] = [];
  if (!config.project?.name) issues.push("config.project.name is missing");
  if (!config.project?.version) issues.push("config.project.version is missing");
  if (!config.packs?.behavior) issues.push("config.packs.behavior is missing");
  if (!config.packs?.resource) issues.push("config.packs.resource is missing");
  if (!config.build?.outDir) issues.push("config.build.outDir is missing");
  if (!config.sync?.defaultTarget)
    issues.push("config.sync.defaultTarget is missing");

  if (config.script) {
    if (!config.script.entry) issues.push("config.script.entry is missing");
    if (!config.script.language)
      issues.push("config.script.language is missing");
    if (!config.script.dependencies?.length)
      issues.push("config.script.dependencies is empty");
  }

  return issues;
}
