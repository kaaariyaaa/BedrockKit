import chokidar from "chokidar";
import { dirname, resolve } from "node:path";
import { intro, outro, multiselect, isCancel } from "@clack/prompts";
import { loadConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { handleBuild } from "./build.js";
import { handleSync } from "./sync.js";
import { readdir } from "node:fs/promises";
import { resolveLang, t } from "../utils/i18n.js";

type ProjectEntry = { name: string; configPath: string };

async function discoverProjects(cwd: string): Promise<ProjectEntry[]> {
  const base = resolve(cwd, "project");
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

export async function handleWatch(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const outDirOverride =
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    (typeof parsed.flags.outdir === "string" && parsed.flags.outdir) ||
    ".watch-dist";
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const log = quiet ? (_msg?: unknown) => {} : console.log;

  const projects = await discoverProjects(process.cwd());
  if (!projects.length) {
    console.error("No projects found under ./project");
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

  intro(t("watch.intro", lang));
  log(`Using watch build outDir: ${outDirOverride}`);

  for (const proj of selectedProjects) {
    const config = await loadConfig(proj.configPath);
    const configDir = dirname(proj.configPath);
    const rootDir = config.paths?.root ? resolve(configDir, config.paths.root) : configDir;
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
        await handleBuild({
          ...ctx,
          argv: ["--config", proj.configPath, "--out-dir", outDirOverride, "--quiet"],
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
        console.error(`[${proj.name}] build+sync failed:`, err instanceof Error ? err.message : err);
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
