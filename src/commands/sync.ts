import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { select, isCancel, confirm } from "@clack/prompts";
import { loadConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { resolveConfigPath } from "../utils/config-discovery.js";
import { handleBuild } from "./build.js";
import type { CopyTaskParameters } from "@minecraft/core-build-tasks";
import { resolveLang, t } from "../utils/i18n.js";

export async function handleSync(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const dryRun = !!parsed.flags["dry-run"];
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const log = jsonOut || quiet ? (_msg?: unknown) => {} : console.log;
  const buildDirOverride =
    (typeof parsed.flags["build-dir"] === "string" && parsed.flags["build-dir"]) ||
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    undefined;
  let shouldBuild = parsed.flags.build !== false; // default true
  if (parsed.flags.build === undefined && !dryRun && !jsonOut && !quiet) {
    const buildChoice = await confirm({
      message: t("sync.runBuild", lang),
      initialValue: true,
    });
    if (isCancel(buildChoice)) {
      console.error(t("sync.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    shouldBuild = !!buildChoice;
  }
  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    console.error(t("common.cancelled", lang));
    process.exitCode = 1;
    return;
  }
  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);
  const rootDir = config.paths?.root ? resolve(configDir, config.paths.root) : configDir;
  const buildDir = resolve(rootDir, buildDirOverride ?? config.build?.outDir ?? "dist");
  const behaviorEnabled = config.packSelection?.behavior !== false;
  const resourceEnabled = config.packSelection?.resource !== false;
  const behaviorSrc = behaviorEnabled ? resolve(buildDir, config.packs.behavior) : null;
  const resourceSrc = resourceEnabled ? resolve(buildDir, config.packs.resource) : null;

  if (shouldBuild && !dryRun) {
    log("Running build before sync...");
    const forward: string[] = [];
    if (jsonOut) forward.push("--json");
    if (quiet) forward.push("--quiet");
    if (buildDirOverride) forward.push("--out-dir", buildDirOverride);
    await handleBuild({ ...ctx, argv: forward });
  }

  if (!(await pathExists(buildDir))) {
    console.error(`Build output not found: ${buildDir}`);
    process.exitCode = 1;
    return;
  }
  if (behaviorEnabled && behaviorSrc && !(await pathExists(behaviorSrc))) {
    console.error(`Behavior build output not found: ${behaviorSrc}. Run 'bkit build' first.`);
    process.exitCode = 1;
    return;
  }
  if (resourceEnabled && resourceSrc && !(await pathExists(resourceSrc))) {
    console.error(`Resource build output not found: ${resourceSrc}. Run 'bkit build' first.`);
    process.exitCode = 1;
    return;
  }

  const targets = config.sync?.targets ?? {};
  const targetNames = Object.keys(targets);
  if (!targetNames.length) {
    console.error(
      "No sync targets defined in config.sync.targets. Add entries like { dev: { behavior: \"/path/to/development_behavior_packs/<name>\", resource: \"/path/to/development_resource_packs/<name>\" } }",
    );
    process.exitCode = 1;
    return;
  }

  let targetName = parsed.flags.target as string | undefined;
  if (!targetName) {
    targetName = config.sync.defaultTarget;
  }
  if (!targetName || !(targetName in targets)) {
    const choice = await select({
      message: t("sync.selectTarget", lang),
      options: targetNames.map((t) => ({ value: t, label: t })),
    });
    if (isCancel(choice)) {
      console.error(t("sync.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    targetName = String(choice);
  }

  const targetConfig = targets[targetName!];

  const synced: { from: string; to?: string; product?: string; projectName?: string }[] = [];

  // If product is specified, use core-build-tasks copyTask (MCBEAddonTemplate style).
  if (targetConfig.product) {
    const projectName = targetConfig.projectName ?? config.project.name;
    if (dryRun) {
      if (!jsonOut) {
        log(
          `[dry-run] Would deploy via core-build-tasks to ${targetConfig.product} as ${projectName}`,
        );
      } else {
        synced.push({ from: buildDir, product: targetConfig.product, projectName });
        console.log(JSON.stringify({ ok: true, dryRun: true, synced }, null, 2));
      }
      return;
    }
    process.env.PROJECT_NAME = projectName;
    process.env.MINECRAFT_PRODUCT = targetConfig.product;
    const coreBuild = await import("@minecraft/core-build-tasks");
    const copyTask = (coreBuild as any).copyTask as
      | ((params: CopyTaskParameters) => () => void)
      | undefined;
    if (!copyTask) {
      console.error("copyTask not found in @minecraft/core-build-tasks");
      process.exitCode = 1;
      return;
    }
    const params: CopyTaskParameters = {
      copyToBehaviorPacks: behaviorEnabled && behaviorSrc ? [behaviorSrc] : [],
      copyToScripts: [],
      copyToResourcePacks: resourceEnabled && resourceSrc ? [resourceSrc] : [],
    };
    try {
      await Promise.resolve(copyTask(params)());
      log(`Synced via core-build-tasks to ${targetConfig.product} (project: ${projectName})`);
    } catch (err) {
      console.error(
        `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    }
    if (jsonOut) {
      synced.push({ from: buildDir, product: targetConfig.product, projectName });
      console.log(JSON.stringify({ ok: process.exitCode !== 1, synced }, null, 2));
    }
    return;
  }

  // Path-based sync (previous behavior)
  if (behaviorEnabled && !targetConfig?.behavior) {
    console.error(`Target '${targetName}' missing behavior path in sync.targets`);
    process.exitCode = 1;
    return;
  }
  if (resourceEnabled && !targetConfig?.resource) {
    console.error(`Target '${targetName}' missing resource path in sync.targets`);
    process.exitCode = 1;
    return;
  }

  const tasks: { from: string; to: string }[] = [];
  if (behaviorEnabled && behaviorSrc) tasks.push({ from: behaviorSrc, to: targetConfig.behavior! });
  if (resourceEnabled && resourceSrc) tasks.push({ from: resourceSrc, to: targetConfig.resource! });

  for (const { from, to } of tasks) {
    if (dryRun) {
      if (!jsonOut) {
        log(`[dry-run] Would sync ${from} -> ${to}`);
      }
      synced.push({ from, to });
      continue;
    }
    await ensureDir(dirname(to));
    await rm(to, { recursive: true, force: true });
    await cp(from, to, { recursive: true, force: true });
    if (!jsonOut) log(`Synced ${from} -> ${to}`);
    synced.push({ from, to });
  }
  if (jsonOut) {
    console.log(JSON.stringify({ ok: true, dryRun, synced }, null, 2));
  }
}
