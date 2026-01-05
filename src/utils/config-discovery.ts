import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { select, isCancel } from "@clack/prompts";
import { pathExists } from "./fs.js";

async function discoverAddonConfigs(cwd: string): Promise<string[]> {
  const base = resolve(cwd, "project");
  if (!(await pathExists(base))) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const configs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = resolve(base, entry.name, "bkit.config.json");
    if (await pathExists(configPath)) configs.push(configPath);
  }
  return configs;
}

export async function resolveConfigPath(flagPath?: string): Promise<string | null> {
  const cwd = process.cwd();
  if (flagPath) return resolve(cwd, flagPath);

  const discovered = await discoverAddonConfigs(cwd);
  if (discovered.length === 0) {
    return resolve(cwd, "bkit.config.json");
  }
  if (discovered.length === 1) return discovered[0];

  const options = discovered.map((p) => ({ value: p, label: p }));
  const choice = await select({
    message: "Select addon config",
    options,
  });
  if (isCancel(choice)) return null;
  return String(choice);
}
