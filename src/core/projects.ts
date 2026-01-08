import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { isCancel, multiselect, select } from "@clack/prompts";
import type { Lang } from "../types.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { pathExists } from "../utils/fs.js";
import { t } from "../utils/i18n.js";

export type ProjectInfo = {
  name: string;
  root: string;
  configPath: string;
};

export type ParsedArgsLike = {
  positional: unknown[];
  flags: Record<string, unknown>;
};

export async function discoverProjects(): Promise<ProjectInfo[]> {
  const settings = await loadSettings();
  const base = resolveProjectRoot(settings);
  if (!(await pathExists(base))) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const found: ProjectInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const root = resolve(base, entry.name);
    const configPath = resolve(root, "bkit.config.json");
    if (await pathExists(configPath)) {
      found.push({ name: entry.name, root, configPath });
    }
  }
  return found;
}

export function parseProjectNames(parsed: ParsedArgsLike): string[] {
  if (parsed.positional.length > 0) return parsed.positional.map(String);
  const flag = parsed.flags.project;
  if (typeof flag === "string") {
    return String(flag)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function resolveProjectsByName(
  names: string[],
  lang: Lang,
): Promise<ProjectInfo[] | null> {
  const projects = await discoverProjects();
  if (!projects.length) return [];
  const map = new Map(projects.map((p) => [p.name, p]));
  const resolved: ProjectInfo[] = [];
  for (const name of names) {
    const entry = map.get(name);
    if (!entry) {
      throw new Error(t("project.notFound", lang, { name }));
    }
    resolved.push(entry);
  }
  return resolved;
}

export async function resolveProjectsFromArgs(
  parsed: ParsedArgsLike,
  lang: Lang,
  opts: { interactive: boolean; initialAll?: boolean },
): Promise<ProjectInfo[] | null> {
  const names = parseProjectNames(parsed);
  if (names.length > 0) return await resolveProjectsByName(names, lang);
  if (!opts.interactive) return [];
  return await promptSelectProjects(lang, { initialAll: opts.initialAll });
}

export async function promptSelectProject(
  lang: Lang,
  opts: { initial?: string } = {},
): Promise<ProjectInfo | null> {
  const projects = await discoverProjects();
  if (!projects.length) return null;
  const choice = await select({
    message: t("project.selectOne", lang),
    options: projects.map((p) => ({ value: p.name, label: p.name })),
    initialValue: opts.initial,
  });
  if (isCancel(choice)) return null;
  const selected = projects.find((p) => p.name === String(choice));
  return selected ?? null;
}

export async function promptSelectProjects(
  lang: Lang,
  opts: { initialAll?: boolean } = {},
): Promise<ProjectInfo[] | null> {
  const projects = await discoverProjects();
  if (!projects.length) return null;
  const choice = await multiselect({
    message: t("project.selectMany", lang),
    options: projects.map((p) => ({ value: p.name, label: p.name })),
    initialValues: opts.initialAll ? projects.map((p) => p.name) : undefined,
  });
  if (isCancel(choice)) return null;
  const selected = new Set(choice as string[]);
  return projects.filter((p) => selected.has(p.name));
}

export async function resolveConfigPathFromArgs(
  parsed: ParsedArgsLike,
  lang: Lang,
  opts: { interactive: boolean; projectArgIndex?: number } = { interactive: false },
): Promise<string | null> {
  const configFlag = parsed.flags.config;
  if (typeof configFlag === "string" && configFlag) return configFlag;

  const idx = opts.projectArgIndex ?? 0;
  const projectArg = parsed.positional[idx] ? String(parsed.positional[idx]) : undefined;
  if (projectArg) {
    const resolved = await resolveProjectsByName([projectArg], lang);
    return resolved?.[0]?.configPath ?? null;
  }

  if (!opts.interactive) return null;
  const picked = await promptSelectProject(lang);
  return picked?.configPath ?? null;
}
