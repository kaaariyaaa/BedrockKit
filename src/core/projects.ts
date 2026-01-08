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

