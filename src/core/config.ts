import { readFile, readdir } from "node:fs/promises";
import { resolve, extname, dirname, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { isCancel, select } from "@clack/prompts";
import { resolveLang, t } from "../utils/i18n.js";
import type { BkitConfig, Lang } from "../types.js";
import { pathExists } from "../utils/fs.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";

export const defaultConfigPath = resolve(process.cwd(), "bkit.config.json");

export type ConfigContext = {
  configPath: string;
  config: BkitConfig;
  configDir: string;
  rootDir: string;
  behavior: { enabled: boolean; path: string | null };
  resource: { enabled: boolean; path: string | null };
};

export async function loadConfig(path: string = defaultConfigPath): Promise<BkitConfig> {
  if (!(await pathExists(path))) {
    throw new Error(`Config not found at ${path}`);
  }

  const ext = extname(path).toLowerCase();
  if (ext === ".json") {
    const raw = await readFile(path, { encoding: "utf8" });
    return JSON.parse(raw) as BkitConfig;
  }

  const mod = await import(pathToFileURL(path).href);
  const cfg = (mod.default ?? mod.config ?? mod) as BkitConfig;
  if (!cfg) {
    throw new Error(`Config module did not export a config object: ${path}`);
  }
  return cfg;
}

export function validateConfig(config: BkitConfig): string[] {
  const issues: string[] = [];
  if (!config.project?.name) issues.push("config.project.name is missing");
  if (!config.project?.version) issues.push("config.project.version is missing");
  if (config.packSelection?.behavior !== false && !config.packs?.behavior)
    issues.push("config.packs.behavior is missing");
  if (config.packSelection?.resource !== false && !config.packs?.resource)
    issues.push("config.packs.resource is missing");
  if (!config.build?.outDir) issues.push("config.build.outDir is missing");
  if (!config.sync?.defaultTarget)
    issues.push("config.sync.defaultTarget is missing");
  if (config.sync?.targets && !(config.sync.defaultTarget in config.sync.targets)) {
    issues.push("config.sync.defaultTarget is not defined in sync.targets");
  }
  if (config.sync?.targets) {
    for (const [name, target] of Object.entries(config.sync.targets)) {
      if (target.product) {
        if (
          target.product !== "BedrockUWP" &&
          target.product !== "PreviewUWP" &&
          target.product !== "BedrockGDK" &&
          target.product !== "PreviewGDK"
        ) {
          issues.push(`sync.targets['${name}'].product is invalid`);
        }
      } else {
        if (config.packSelection?.behavior !== false && !target.behavior) {
          issues.push(`sync.targets['${name}'].behavior is missing`);
        }
        if (config.packSelection?.resource !== false && !target.resource) {
          issues.push(`sync.targets['${name}'].resource is missing`);
        }
      }
    }
  }
  if (config.paths && typeof config.paths !== "object")
    issues.push("config.paths must be an object if present");

  if (config.script) {
    if (!config.script.entry) issues.push("config.script.entry is missing");
    if (!config.script.language)
      issues.push("config.script.language is missing");
    if (!config.script.dependencies?.length)
      issues.push("config.script.dependencies is empty");
    if (config.script.apiVersion && typeof config.script.apiVersion !== "string")
      issues.push("config.script.apiVersion must be a string if provided");
  }

  return issues;
}

export async function resolveConfigPath(flagPath?: string, langInput?: string | boolean): Promise<string | null> {
  const cwd = process.cwd();
  const lang: Lang = resolveLang(langInput);
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
    message: t("config.selectProject", lang),
    options,
  });
  if (isCancel(choice)) return null;
  return String(choice);
}

export async function loadConfigContext(configPath: string): Promise<ConfigContext> {
  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);
  const rootDir = config.paths?.root ? resolve(configDir, config.paths.root) : configDir;
  const behaviorEnabled = config.packSelection?.behavior !== false;
  const resourceEnabled = config.packSelection?.resource !== false;
  const behaviorPath = behaviorEnabled ? resolve(rootDir, config.packs.behavior) : null;
  const resourcePath = resourceEnabled ? resolve(rootDir, config.packs.resource) : null;

  return {
    configPath,
    config,
    configDir,
    rootDir,
    behavior: { enabled: behaviorEnabled, path: behaviorPath },
    resource: { enabled: resourceEnabled, path: resourcePath },
  };
}

export function resolveOutDir(ctx: ConfigContext, override?: string): string {
  return resolve(ctx.rootDir, override ?? ctx.config.build?.outDir ?? "dist");
}

async function discoverAddonConfigs(cwd: string): Promise<string[]> {
  const settings = await loadSettings();
  const base = resolveProjectRoot(settings);
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
