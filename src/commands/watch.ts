import chokidar from "chokidar";
import { resolve, join, dirname } from "node:path";
import { intro, outro, multiselect, isCancel, select } from "@clack/prompts";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveOutDir } from "../core/config.js";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { runBuildWithMode, runScriptBuildOnly } from "./build.js";
import { handleSync } from "./sync.js";
import { readdir, readFile, rm, writeFile, lstat, symlink, cp } from "node:fs/promises";
import { resolveLang, t } from "../utils/i18n.js";
import { getSettingsPath, loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { createRequire } from "node:module";
import { loadIgnoreRules, isIgnored } from "../utils/ignore.js";

type ProjectEntry = { name: string; configPath: string };
type WatchState = {
  mode: "link";
  outDir: string;
  projects: ProjectEntry[];
  startedAt: string;
};
type BuildMode = "copy" | "link";
type SyncTargetConfig = {
  behavior?: string;
  resource?: string;
  product?: string;
  projectName?: string;
};

const watchStatePath = resolve(dirname(getSettingsPath()), "watch-link.json");
const DEVELOPMENT_BEHAVIOR = "development_behavior_packs";
const DEVELOPMENT_RESOURCE = "development_resource_packs";

async function discoverProjects(cwd: string): Promise<ProjectEntry[]> {
  const settings = await loadSettings();
  const base = resolveProjectRoot(settings);
  if (!(await pathExists(base))) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const found: ProjectEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cfg = resolve(base, entry.name, "bkit.config.json");
    if (await pathExists(cfg)) {
      found.push({ name: entry.name, configPath: cfg });
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

async function pickTargetName(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  lang: Lang,
  interactive: boolean,
): Promise<string | null> {
  const targets = configCtx.config.sync?.targets ?? {};
  const names = Object.keys(targets);
  if (!names.length) return null;
  const defaultName = configCtx.config.sync.defaultTarget;
  if (!interactive) {
    if (defaultName && defaultName in targets) return defaultName;
    return names[0] ?? null;
  }
  if (defaultName && defaultName in targets) return defaultName;
  if (names.length === 1) return names[0]!;
  const choice = await select({
    message: t("sync.selectTarget", lang),
    options: names.map((name) => ({ value: name, label: name })),
  });
  if (isCancel(choice)) return null;
  return String(choice);
}

async function linkEntries(
  srcDir: string,
  destDir: string,
  rootDir: string,
  ignoreRules: RegExp[],
  excludeNames?: Set<string>,
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeNames?.has(entry.name)) continue;
    const srcPath = resolve(srcDir, entry.name);
    if (isIgnored(srcPath, rootDir, ignoreRules)) continue;
    const destPath = resolve(destDir, entry.name);
    if (await pathExists(destPath)) {
      await rm(destPath, { recursive: true, force: true });
    }
    if (entry.isDirectory()) {
      const type = process.platform === "win32" ? "junction" : "dir";
      await symlink(srcPath, destPath, type);
    } else if (entry.isSymbolicLink()) {
      const stat = await lstat(srcPath);
      const type = stat.isDirectory()
        ? process.platform === "win32"
          ? "junction"
          : "dir"
        : "file";
      await symlink(srcPath, destPath, type);
    } else {
      await symlink(srcPath, destPath, "file");
    }
  }
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

async function saveWatchState(state: WatchState): Promise<void> {
  await writeFile(watchStatePath, JSON.stringify(state, null, 2), "utf8");
}

async function removeWatchState(): Promise<void> {
  if (!(await pathExists(watchStatePath))) return;
  await rm(watchStatePath, { force: true });
}

async function hasTypeScriptScripts(packRoot: string): Promise<boolean> {
  const scriptsRoot = resolve(packRoot, "scripts");
  if (!(await pathExists(scriptsRoot))) return false;
  const stack = [scriptsRoot];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        return true;
      }
    }
  }
  return false;
}

async function copyBehaviorPackFinal(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  targetPath: string,
  outDirOverride: string,
): Promise<void> {
  const { config, rootDir } = configCtx;
  const ignoreRules = await loadIgnoreRules(rootDir);
  const behaviorSrc = configCtx.behavior.path;
  if (!behaviorSrc) return;
  const hasTs = await hasTypeScriptScripts(behaviorSrc);
  await ensureDir(dirname(targetPath));
  await rm(targetPath, { recursive: true, force: true });
  await cp(behaviorSrc, targetPath, {
    recursive: true,
    force: true,
    filter: (src) => {
      if (isIgnored(src, rootDir, ignoreRules)) return false;
      if (!hasTs) return true;
      const rel = src.replace(/\\/g, "/");
      if (!rel.includes("/scripts/")) return true;
      return !rel.endsWith(".ts");
    },
  });
  if (hasTs) {
    const buildDir = resolveOutDir(configCtx, outDirOverride);
    const scriptsOut = resolve(buildDir, config.packs.behavior, "scripts");
    if (await pathExists(scriptsOut)) {
      const scriptsTarget = resolve(targetPath, "scripts");
      await rm(scriptsTarget, { recursive: true, force: true });
      await ensureDir(scriptsTarget);
      await cp(scriptsOut, scriptsTarget, { recursive: true, force: true });
    }
  }
}

async function copyResourcePackFinal(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  targetPath: string,
): Promise<void> {
  const { rootDir } = configCtx;
  const ignoreRules = await loadIgnoreRules(rootDir);
  const resourceSrc = configCtx.resource.path;
  if (!resourceSrc) return;
  await ensureDir(dirname(targetPath));
  await rm(targetPath, { recursive: true, force: true });
  await cp(resourceSrc, targetPath, {
    recursive: true,
    force: true,
    filter: (src) => !isIgnored(src, rootDir, ignoreRules),
  });
}

async function syncLinkMode(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  outDirOverride: string,
  lang: Lang,
): Promise<void> {
  const { config, rootDir } = configCtx;
  const ignoreRules = await loadIgnoreRules(rootDir);
  const buildDir = resolveOutDir(configCtx, outDirOverride);
  const targetName = await pickTargetName(configCtx, lang, true);
  if (!targetName) {
    throw new Error(t("watch.noSyncTargetSelected", lang));
  }
  const targets = config.sync?.targets ?? {};
  const targetConfig = targets[targetName] as SyncTargetConfig | undefined;
  if (!targetConfig) {
    throw new Error(t("watch.syncTargetNotFound", lang, { target: targetName }));
  }
  const projectName = targetConfig.projectName ?? config.project.name;
  const targetPaths = resolveTargetPaths(targetConfig, projectName);
  if (configCtx.behavior.enabled && !targetPaths.behavior) {
    throw new Error(t("watch.targetMissingBehavior", lang, { target: targetName }));
  }
  if (configCtx.resource.enabled && !targetPaths.resource) {
    throw new Error(t("watch.targetMissingResource", lang, { target: targetName }));
  }

  if (configCtx.behavior.enabled && configCtx.behavior.path && targetPaths.behavior) {
    const behaviorSrc = configCtx.behavior.path;
    const behaviorDest = targetPaths.behavior;
    const hasTs = await hasTypeScriptScripts(behaviorSrc);
    await ensureDir(behaviorDest);
    await linkEntries(
      behaviorSrc,
      behaviorDest,
      rootDir,
      ignoreRules,
      hasTs ? new Set(["scripts"]) : undefined,
    );
    if (hasTs) {
      const scriptsOut = resolve(buildDir, config.packs.behavior, "scripts");
      if (await pathExists(scriptsOut)) {
        const scriptsTarget = resolve(behaviorDest, "scripts");
        await rm(scriptsTarget, { recursive: true, force: true });
        await ensureDir(scriptsTarget);
        await cp(scriptsOut, scriptsTarget, { recursive: true, force: true });
      }
    }
  }

  if (configCtx.resource.enabled && configCtx.resource.path && targetPaths.resource) {
    const resourceSrc = configCtx.resource.path;
    const resourceDest = targetPaths.resource;
    await ensureDir(resourceDest);
    await linkEntries(resourceSrc, resourceDest, rootDir, ignoreRules);
  }
}

async function removeLinkTargets(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  lang: Lang,
): Promise<void> {
  const { config } = configCtx;
  const targetName = await pickTargetName(configCtx, lang, false);
  if (!targetName) {
    throw new Error(t("watch.noSyncTargetSelected", lang));
  }
  const targets = config.sync?.targets ?? {};
  const targetConfig = targets[targetName] as SyncTargetConfig | undefined;
  if (!targetConfig) {
    throw new Error(t("watch.syncTargetNotFound", lang, { target: targetName }));
  }
  const projectName = targetConfig.projectName ?? config.project.name;
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

async function finalizeSyncCopy(
  configCtx: Awaited<ReturnType<typeof loadConfigContext>>,
  outDir: string,
  lang: Lang,
): Promise<void> {
  const { config } = configCtx;
  const targetName = await pickTargetName(configCtx, lang, false);
  if (!targetName) {
    throw new Error(t("watch.noSyncTargetSelected", lang));
  }
  const targets = config.sync?.targets ?? {};
  const targetConfig = targets[targetName] as SyncTargetConfig | undefined;
  if (!targetConfig) {
    throw new Error(t("watch.syncTargetNotFound", lang, { target: targetName }));
  }
  const projectName = targetConfig.projectName ?? config.project.name;
  const targetPaths = resolveTargetPaths(targetConfig, projectName);

  if (configCtx.behavior.enabled && targetPaths.behavior) {
    await copyBehaviorPackFinal(configCtx, targetPaths.behavior, outDir);
  }
  if (configCtx.resource.enabled && targetPaths.resource) {
    await copyResourcePackFinal(configCtx, targetPaths.resource);
  }
}

async function finalizeWatchBuilds(
  projects: ProjectEntry[],
  outDir: string,
  lang: Lang,
): Promise<void> {
  for (const proj of projects) {
    try {
      const configCtx = await loadConfigContext(proj.configPath);
      try {
        await removeLinkTargets(configCtx, lang);
      } catch (err) {
        console.error(
          t("watch.finalizeUnlinkFailed", lang, {
            name: proj.name,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        throw err;
      }
      try {
        await finalizeSyncCopy(configCtx, outDir, lang);
      } catch (err) {
        console.error(
          t("watch.finalizeSyncFailed", lang, {
            name: proj.name,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        throw err;
      }
    } catch (err) {
      console.error(
        t("watch.finalizeFailed", lang, {
          name: proj.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

async function recoverFromWatchState(
  log: (msg: string) => void,
  defaultOutDir: string,
  lang: Lang,
): Promise<void> {
  if (!(await pathExists(watchStatePath))) return;
  try {
    const raw = await readFile(watchStatePath, "utf8");
    const state = JSON.parse(raw) as WatchState;
    if (state.mode !== "link") {
      await removeWatchState();
      return;
    }
    const outDir = state.outDir || defaultOutDir;
    log(t("watch.recoverNotice", lang));
    await finalizeWatchBuilds(state.projects, outDir, lang);
  } catch (err) {
    console.error(
      t("watch.recoverFailed", lang, {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  } finally {
    await removeWatchState();
  }
}

export async function handleWatch(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const outDirOverride =
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    (typeof parsed.flags.outdir === "string" && parsed.flags.outdir) ||
    ".watch-dist";
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const { info: log } = createLogger({ quiet });

  await recoverFromWatchState(log, outDirOverride, lang);

  const settings = await loadSettings();
  const projects = await discoverProjects(process.cwd());
  if (!projects.length) {
    console.error(
      t("watch.noProjectsFound", lang, { path: resolveProjectRoot(settings) }),
    );
    return;
  }

  let selected: string[] = parsed.positional.length
    ? parsed.positional.map(String)
    : parsed.flags.projects
    ? String(parsed.flags.projects)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!selected.length) {
    const choice = await multiselect({
      message: t("watch.selectProjects", lang),
      options: projects.map((p) => ({ value: p.name, label: p.name })),
      initialValues: projects.map((p) => p.name),
    });
    if (isCancel(choice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    selected = choice as string[];
  }

  const selectedProjects = projects.filter((p) => selected.includes(p.name));
  if (!selectedProjects.length) {
    console.error(t("watch.noProjectsSelected", lang));
    return;
  }

  const modeFlag = parsed.flags.mode as string | undefined;
  let buildMode: BuildMode | undefined =
    modeFlag === "link" || parsed.flags.link
      ? "link"
      : modeFlag === "copy" || parsed.flags.copy
        ? "copy"
        : undefined;
  if (!buildMode && !quiet) {
    const choice = await select({
      message: t("watch.selectMode", lang),
      options: [
        { value: "copy", label: t("watch.mode.copyRecommended", lang) },
        { value: "link", label: t("watch.mode.link", lang) },
      ],
      initialValue: "copy",
    });
    if (isCancel(choice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    buildMode = String(choice) as BuildMode;
  }
  buildMode = buildMode ?? "copy";

  let cleanupRequested = false;
  const finalizeAndExit = async () => {
    if (cleanupRequested) return;
    cleanupRequested = true;
    if (buildMode === "link") {
      log(t("watch.finalizeNotice", lang));
      await finalizeWatchBuilds(selectedProjects, outDirOverride, lang);
      await removeWatchState();
    }
    process.exit();
  };
  if (buildMode === "link") {
    await saveWatchState({
      mode: "link",
      outDir: outDirOverride,
      projects: selectedProjects,
      startedAt: new Date().toISOString(),
    });
    process.once("SIGINT", () => void finalizeAndExit());
    process.once("SIGTERM", () => void finalizeAndExit());
  }

  intro(t("watch.intro", lang));
  log(t("watch.outDir", lang, { outDir: outDirOverride, mode: buildMode }));

  for (const proj of selectedProjects) {
    const configCtx = await loadConfigContext(proj.configPath);
    const { config, rootDir } = configCtx;
    const watchPaths = [];
    if (config.packSelection?.behavior !== false) {
      watchPaths.push(resolve(rootDir, config.packs.behavior));
    }
    if (config.packSelection?.resource !== false) {
      watchPaths.push(resolve(rootDir, config.packs.resource));
    }
    const watcher = chokidar.watch(watchPaths, {
      ignored: ["**/dist/**", "**/.watch-dist/**", "**/node_modules/**"],
      ignoreInitial: true,
    });
    let pending = false;
    const trigger = async (reason: string) => {
      if (pending) return;
      pending = true;
      log(
        t("watch.changeDetected", lang, { name: proj.name, reason }),
      );
      try {
        if (buildMode === "link") {
          await runScriptBuildOnly({
            configPath: proj.configPath,
            outDirOverride,
            quiet: true,
            lang,
          });
        } else {
          await runBuildWithMode({
            configPath: proj.configPath,
            outDirOverride,
            mode: buildMode,
            quiet: true,
            lang,
          });
        }
        if (buildMode === "link") {
          const configCtx = await loadConfigContext(proj.configPath);
          await syncLinkMode(configCtx, outDirOverride, lang);
        } else {
          await handleSync({
            ...ctx,
            argv: [
              proj.name,
              "--build=false",
              "--build-dir",
              outDirOverride,
              "--quiet",
            ],
          });
        }
        log(t("watch.buildSyncCompleted", lang, { name: proj.name }));
      } catch (err) {
        console.error(
          t("watch.buildSyncFailed", lang, {
            name: proj.name,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        pending = false;
      }
    };
    watcher.on("add", (p) => trigger(`add ${p}`));
    watcher.on("change", (p) => trigger(`change ${p}`));
    watcher.on("unlink", (p) => trigger(`unlink ${p}`));
    log(
      t("watch.watching", lang, {
        name: proj.name,
        paths: watchPaths.join(", "),
      }),
    );
  }
}
