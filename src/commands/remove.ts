import { rm, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { select, confirm, isCancel } from "@clack/prompts";
import { loadConfigContext } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { resolveLang, t } from "../utils/i18n.js";

type ProjectEntry = { name: string; root: string; configPath: string };

async function discoverProjects(): Promise<ProjectEntry[]> {
  const settings = await loadSettings();
  const base = resolveProjectRoot(settings);
  if (!(await pathExists(base))) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const found: ProjectEntry[] = [];
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

export async function handleRemove(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const yes = !!parsed.flags.yes;

  const projects = await discoverProjects();
  if (!projects.length) {
    console.error(t("remove.none", lang));
    process.exitCode = 1;
    return;
  }

  let projectName = parsed.flags.project as string | undefined;
  if (!projectName && parsed.positional[0]) {
    projectName = String(parsed.positional[0]);
  }
  if (!projectName && !quiet) {
    const choice = await select({
      message: t("remove.selectProject", lang),
      options: projects.map((p) => ({ value: p.name, label: p.name })),
    });
    if (isCancel(choice)) {
      console.error(t("common.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    projectName = String(choice);
  }

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    console.error(t("remove.notFound", lang, { name: projectName ?? "" }));
    process.exitCode = 1;
    return;
  }

  const configCtx = await loadConfigContext(project.configPath);
  const distDir = resolve(project.root, configCtx.config.build?.outDir ?? "dist");
  const watchDir = resolve(project.root, ".watch-dist");

  const removeDist = parsed.flags.dist ? true : false;
  const removeWatch = parsed.flags.watch ? true : false;

  if (!quiet && !yes) {
    const ok = await confirm({
      message: t("remove.confirmProject", lang, { name: project.name }),
      initialValue: false,
    });
    if (isCancel(ok) || !ok) {
      console.error(t("common.cancelled", lang));
      process.exitCode = 1;
      return;
    }
  }

  await rm(project.root, { recursive: true, force: true });
  if (removeDist) {
    await rm(distDir, { recursive: true, force: true });
  }
  if (removeWatch) {
    await rm(watchDir, { recursive: true, force: true });
  }

  if (!quiet) {
    console.log(t("remove.done", lang, { name: project.name }));
  }
}
