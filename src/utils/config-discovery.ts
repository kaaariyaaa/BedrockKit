import { resolve, dirname, basename, relative } from "node:path";
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

  const cwdRel = (p: string) => relative(cwd, p).replace(/\\/g, "/");
  const options = discovered.map((p) => {
    const projectName = basename(dirname(p));
    return {
      value: p,
      label: `${projectName} (${cwdRel(p)})`,
    };
  });
  const choice = await select({
    message: "Select project",
    options,
  });
  if (isCancel(choice)) return null;
  return String(choice);
}
