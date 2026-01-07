import { rm, readdir, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { select, confirm, isCancel } from "@clack/prompts";
import { loadConfigContext } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { resolveLang, t } from "../utils/i18n.js";
import { createRequire } from "node:module";

type ProjectEntry = { name: string; root: string; configPath: string };
type SyncTargetConfig = {
  behavior?: string;
  resource?: string;
  product?: string;
  projectName?: string;
};

const DEVELOPMENT_BEHAVIOR = "development_behavior_packs";
const DEVELOPMENT_RESOURCE = "development_resource_packs";

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

function resolveTargetPaths(
  target: SyncTargetConfig,
  projectName: string,
): { behavior?: string; resource?: string } {
  if (target.behavior || target.resource) {
    return { behavior: target.behavior, resource: target.resource };
  }
  if (!target.product) return {};
  const require = createRequire(import.meta.url);
  const coreBuild = require("@minecraft/core-build-tasks");
  const getGameDeploymentRootPaths = (coreBuild as any).getGameDeploymentRootPaths as
    | (() => Record<string, string | undefined>)
    | undefined;
  if (!getGameDeploymentRootPaths) return {};
  const rootPaths = getGameDeploymentRootPaths();
  const root = rootPaths[target.product];
  if (!root) return {};
  return {
    behavior: join(root, DEVELOPMENT_BEHAVIOR, projectName),
    resource: join(root, DEVELOPMENT_RESOURCE, projectName),
  };
}

async function removeSymlinkEntries(rootDir: string): Promise<void> {
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      const stat = await lstat(fullPath);
      if (stat.isSymbolicLink()) {
        await rm(fullPath, { recursive: true, force: true });
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
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
  const targetNames = Object.keys(configCtx.config.sync?.targets ?? {});
  let targetName = (parsed.flags.target as string | undefined) ?? configCtx.config.sync?.defaultTarget;
  if (!targetName || !(targetName in (configCtx.config.sync?.targets ?? {}))) {
    if (targetNames.length === 1) {
      targetName = targetNames[0];
    } else if (targetNames.length && !quiet) {
      const choice = await select({
        message: t("sync.selectTarget", lang),
        options: targetNames.map((name) => ({ value: name, label: name })),
      });
      if (!isCancel(choice)) targetName = String(choice);
    }
  }

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

  if (targetName) {
    const targetConfig = (configCtx.config.sync?.targets ?? {})[targetName] as SyncTargetConfig | undefined;
    if (targetConfig) {
      const projectName = targetConfig.projectName ?? configCtx.config.project?.name ?? project.name;
      const targetPaths = resolveTargetPaths(targetConfig, projectName);
      const candidates = [targetPaths.behavior, targetPaths.resource].filter(
        (p): p is string => !!p,
      );
      for (const targetPath of candidates) {
        if (!(await pathExists(targetPath))) continue;
        const stat = await lstat(targetPath);
        if (stat.isSymbolicLink()) {
          await rm(targetPath, { recursive: true, force: true });
          continue;
        }
        if (!stat.isDirectory()) continue;
        await removeSymlinkEntries(targetPath);
      }
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
