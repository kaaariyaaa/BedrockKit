import chokidar from "chokidar";
import { resolve } from "node:path";
import { intro, outro, multiselect, isCancel, select } from "@clack/prompts";
import { createLogger } from "../core/logger.js";
import { loadConfigContext } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { runBuildWithMode } from "./build.js";
import { handleSync } from "./sync.js";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolveLang, t } from "../utils/i18n.js";
import { getSettingsPath, loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { dirname } from "node:path";

type ProjectEntry = { name: string; configPath: string };
type WatchState = {
  mode: "link";
  outDir: string;
  projects: ProjectEntry[];
  startedAt: string;
};
type BuildMode = "copy" | "link";

const watchStatePath = resolve(dirname(getSettingsPath()), "watch-link.json");

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

async function saveWatchState(state: WatchState): Promise<void> {
  await writeFile(watchStatePath, JSON.stringify(state, null, 2), "utf8");
}

async function removeWatchState(): Promise<void> {
  if (!(await pathExists(watchStatePath))) return;
  await rm(watchStatePath, { force: true });
}

async function recoverFromWatchState(
  log: (msg: string) => void,
  defaultOutDir: string,
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
    log("Detected leftover watch link state. Finalizing build outputs...");
    await finalizeWatchBuilds(state.projects, outDir);
  } catch (err) {
    console.error(
      `Failed to recover watch state: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    await removeWatchState();
  }
}

async function finalizeWatchBuilds(
  projects: ProjectEntry[],
  outDir: string,
): Promise<void> {
  for (const proj of projects) {
    try {
      await runBuildWithMode({
        configPath: proj.configPath,
        outDirOverride: outDir,
        mode: "copy",
        quiet: true,
      });
      await handleSync({
        argv: ["--config", proj.configPath, "--build=false", "--build-dir", outDir, "--quiet"],
        root: process.cwd(),
      });
    } catch (err) {
      console.error(
        `[${proj.name}] finalize build failed: ${err instanceof Error ? err.message : err}`,
      );
    }
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

  await recoverFromWatchState(log, outDirOverride);

  const settings = await loadSettings();
  const projects = await discoverProjects(process.cwd());
  if (!projects.length) {
    console.error(`No projects found under ${resolveProjectRoot(settings)}`);
    return;
  }

  let selected: string[] = parsed.flags.projects
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
    console.error("No projects selected.");
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
      log("Finalizing build outputs (copy mode)...");
      await finalizeWatchBuilds(selectedProjects, outDirOverride);
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
  log(`Using watch build outDir: ${outDirOverride} (mode: ${buildMode})`);

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
      log(`[${proj.name}] change detected (${reason}), building...`);
      try {
        await runBuildWithMode({
          configPath: proj.configPath,
          outDirOverride,
          mode: buildMode,
          quiet: true,
        });
        await handleSync({
          ...ctx,
          argv: [
            "--config",
            proj.configPath,
            "--build=false",
            "--build-dir",
            outDirOverride,
            "--quiet",
          ],
        });
        log(`[${proj.name}] build+sync completed.`);
      } catch (err) {
        console.error(
          `[${proj.name}] build+sync failed:`,
          err instanceof Error ? err.message : err,
        );
      } finally {
        pending = false;
      }
    };
    watcher.on("add", (p) => trigger(`add ${p}`));
    watcher.on("change", (p) => trigger(`change ${p}`));
    watcher.on("unlink", (p) => trigger(`unlink ${p}`));
    log(`[${proj.name}] watching ${watchPaths.join(", ")}`);
  }
}
