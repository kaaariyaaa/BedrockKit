import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { select, isCancel, confirm } from "@clack/prompts";
import type { CopyTaskParameters } from "@minecraft/core-build-tasks";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveOutDir } from "../core/config.js";
import { resolveProjectsFromArgs } from "../core/projects.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { handleBuild } from "./build.js";
import { resolveLang, t } from "../utils/i18n.js";

export async function handleSync(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const dryRun = !!parsed.flags["dry-run"];
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const interactive = !jsonOut && !quiet && !parsed.flags.yes;
  const { info: log } = createLogger({ json: jsonOut, quiet });
  const buildDirOverride =
    (typeof parsed.flags["build-dir"] === "string" && parsed.flags["build-dir"]) ||
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    undefined;
  let shouldBuild = parsed.flags.build === true; // default false
  if (parsed.flags.build === undefined && !dryRun && !jsonOut && !quiet) {
    const buildChoice = await confirm({
      message: t("sync.runBuild", lang),
      initialValue: false,
    });
    if (isCancel(buildChoice)) {
      console.error(t("sync.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    shouldBuild = !!buildChoice;
  }

  let projects: Awaited<ReturnType<typeof resolveProjectsFromArgs>>;
  try {
    projects = await resolveProjectsFromArgs(parsed, lang, { interactive, initialAll: true });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (projects === null) {
    console.error(t("common.cancelled", lang));
    process.exitCode = 1;
    return;
  }
  projects = projects ?? [];
  if (!projects.length) {
    console.error(t("project.noneFound", lang));
    process.exitCode = 1;
    return;
  }

  for (const proj of projects) {
    await runSyncOne(
      { ...ctx, argv: [] },
      {
        configPath: proj.configPath,
        buildDirOverride,
        shouldBuild,
        dryRun,
        jsonOut,
        quiet,
        target: parsed.flags.target as string | undefined,
      },
      lang,
    );
  }
}

async function runSyncOne(
  ctx: CommandContext,
  opts: {
    configPath: string;
    buildDirOverride?: string;
    shouldBuild: boolean;
    dryRun: boolean;
    jsonOut: boolean;
    quiet: boolean;
    target?: string;
  },
  lang: string,
): Promise<void> {
  const { info: log } = createLogger({ json: opts.jsonOut, quiet: opts.quiet });
  const configCtx = await loadConfigContext(opts.configPath);
  const { config } = configCtx;
  const buildDir = resolveOutDir(configCtx, opts.buildDirOverride);
  const behaviorEnabled = configCtx.behavior.enabled;
  const resourceEnabled = configCtx.resource.enabled;
  const behaviorSrc = behaviorEnabled ? resolve(buildDir, config.packs.behavior) : null;
  const resourceSrc = resourceEnabled ? resolve(buildDir, config.packs.resource) : null;

  if (opts.shouldBuild && !opts.dryRun) {
    log(t("sync.runBuildNow", resolveLang(lang)));
    const forward: string[] = ["--project", config.project.name];
    if (opts.jsonOut) forward.push("--json");
    if (opts.quiet) forward.push("--quiet");
    if (opts.buildDirOverride) forward.push("--out-dir", opts.buildDirOverride);
    await handleBuild({ ...ctx, argv: forward, lang: resolveLang(lang) });
  }

  if (!(await pathExists(buildDir))) {
    console.error(t("sync.buildOutputNotFound", resolveLang(lang), { path: buildDir }));
    process.exitCode = 1;
    return;
  }
  if (behaviorEnabled && behaviorSrc && !(await pathExists(behaviorSrc))) {
    console.error(
      t("sync.behaviorOutputNotFound", resolveLang(lang), { path: behaviorSrc }),
    );
    process.exitCode = 1;
    return;
  }
  if (resourceEnabled && resourceSrc && !(await pathExists(resourceSrc))) {
    console.error(
      t("sync.resourceOutputNotFound", resolveLang(lang), { path: resourceSrc }),
    );
    process.exitCode = 1;
    return;
  }

  const targets = config.sync?.targets ?? {};
  const targetNames = Object.keys(targets);
  if (!targetNames.length) {
    console.error(t("sync.noTargets", resolveLang(lang)));
    process.exitCode = 1;
    return;
  }

  let targetName = opts.target;
  if (!targetName) {
    targetName = config.sync.defaultTarget;
  }
  if (!targetName || !(targetName in targets)) {
    const choice = await select({
      message: t("sync.selectTarget", resolveLang(lang)),
      options: targetNames.map((tName) => ({ value: tName, label: tName })),
    });
    if (isCancel(choice)) {
      console.error(t("sync.cancelled", resolveLang(lang)));
      process.exitCode = 1;
      return;
    }
    targetName = String(choice);
  }

  const targetConfig = targets[targetName!];
  const synced: { from: string; to?: string; product?: string; projectName?: string }[] = [];

  if (targetConfig.product) {
    const projectName = targetConfig.projectName ?? config.project.name;
    if (opts.dryRun) {
      if (!opts.jsonOut) {
        log(
          t("sync.dryRunProduct", resolveLang(lang), {
            product: targetConfig.product,
            project: projectName,
          }),
        );
      } else {
        synced.push({ from: buildDir, product: targetConfig.product, projectName });
        console.log(JSON.stringify({ ok: true, dryRun: true, synced }, null, 2));
      }
      return;
    }
    process.env.PROJECT_NAME = projectName;
    process.env.MINECRAFT_PRODUCT = targetConfig.product;
    const require = createRequire(import.meta.url);
    const coreBuild = require("@minecraft/core-build-tasks");
    const copyTask = (coreBuild as any).copyTask as
      | ((params: CopyTaskParameters) => () => void)
      | undefined;
    if (!copyTask) {
      console.error(t("sync.copyTaskMissing", resolveLang(lang)));
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
      log(
        t("sync.syncedProduct", resolveLang(lang), {
          product: targetConfig.product,
          project: projectName,
        }),
      );
    } catch (err) {
      console.error(
        t("sync.failed", resolveLang(lang), {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      process.exitCode = 1;
    }
    if (opts.jsonOut) {
      synced.push({ from: buildDir, product: targetConfig.product, projectName });
      console.log(JSON.stringify({ ok: process.exitCode !== 1, synced }, null, 2));
    }
    return;
  }

  if (behaviorEnabled && !targetConfig?.behavior) {
    console.error(t("sync.targetMissingBehavior", resolveLang(lang), { target: targetName }));
    process.exitCode = 1;
    return;
  }
  if (resourceEnabled && !targetConfig?.resource) {
    console.error(t("sync.targetMissingResource", resolveLang(lang), { target: targetName }));
    process.exitCode = 1;
    return;
  }

  const tasks: { from: string; to: string }[] = [];
  if (behaviorEnabled && behaviorSrc) tasks.push({ from: behaviorSrc, to: targetConfig.behavior! });
  if (resourceEnabled && resourceSrc) tasks.push({ from: resourceSrc, to: targetConfig.resource! });

  for (const { from, to } of tasks) {
    if (opts.dryRun) {
      if (!opts.jsonOut) log(t("sync.dryRunSync", resolveLang(lang), { from, to }));
      synced.push({ from, to });
      continue;
    }
    await ensureDir(dirname(to));
    await rm(to, { recursive: true, force: true });
    await cp(from, to, { recursive: true, force: true });
    if (!opts.jsonOut) log(t("sync.synced", resolveLang(lang), { from, to }));
    synced.push({ from, to });
  }
  if (opts.jsonOut) {
    console.log(JSON.stringify({ ok: true, dryRun: opts.dryRun, synced }, null, 2));
  }
}
