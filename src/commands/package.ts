import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { confirm, isCancel } from "@clack/prompts";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveConfigPath, resolveOutDir } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { handleBuild } from "./build.js";
import { resolveLang, t } from "../utils/i18n.js";

export async function handlePackage(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const { info: log } = createLogger({ json: jsonOut, quiet });
  let shouldBuild = parsed.flags.build !== false; // default true
  if (parsed.flags.build === undefined) {
    if (!jsonOut) {
      const buildChoice = await confirm({
        message: t("package.runBuild", lang),
        initialValue: true,
      });
      if (isCancel(buildChoice)) {
        console.error(t("package.cancelled", lang));
        process.exitCode = 1;
        return;
      }
      shouldBuild = !!buildChoice;
    }
  }
  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    console.error("Config selection cancelled.");
    process.exitCode = 1;
    return;
  }

  if (!(await pathExists(configPath))) {
    console.error(`Config not found: ${configPath}`);
    process.exitCode = 1;
    return;
  }

  const configCtx = await loadConfigContext(configPath);
  const { config } = configCtx;
  const buildDir = resolveOutDir(configCtx);

  if (shouldBuild) {
    log("Running build before packaging...");
    const forwardFlags = ["--config", configPath];
    if (jsonOut) forwardFlags.push("--json");
    if (quiet) forwardFlags.push("--quiet");
    await handleBuild({ ...ctx, argv: forwardFlags });
  }

  if (!(await pathExists(buildDir))) {
    console.error(`Build directory not found: ${buildDir}`);
    process.exitCode = 1;
    return;
  }

  const stats = await stat(buildDir);
  if (!stats.isDirectory()) {
    console.error(`Build path is not a directory: ${buildDir}`);
    process.exitCode = 1;
    return;
  }

  const outArg = parsed.flags.out as string | undefined;
  const baseName =
    (outArg ? outArg.replace(/\.mcpack$/i, "").replace(/\.mcaddon$/i, "") : config.project?.name) ??
    "addon";
  const behaviorOut = resolve(buildDir, `${baseName}_behavior.mcpack`);
  const resourceOut = resolve(buildDir, `${baseName}_resource.mcpack`);

  if (!jsonOut) {
    log(`Packaging '${buildDir}' -> '${behaviorOut}', '${resourceOut}' ...`);
  }
  const produced: string[] = [];
  try {
    const zipTask = await getZipTask();
    const behaviorEnabled = configCtx.behavior.enabled;
    const resourceEnabled = configCtx.resource.enabled;
    const behaviorPath = behaviorEnabled ? resolve(buildDir, config.packs.behavior) : null;
    const resourcePath = resourceEnabled ? resolve(buildDir, config.packs.resource) : null;

    if (behaviorEnabled && behaviorPath) {
      const behaviorTask = zipTask(behaviorOut, [
        { contents: [behaviorPath], targetPath: "" },
      ]);
      await runTask(behaviorTask);
      if (!jsonOut) log(`Behavior pack created: ${behaviorOut}`);
      produced.push(behaviorOut);
    }
    if (resourceEnabled && resourcePath) {
      const resourceTask = zipTask(resourceOut, [
        { contents: [resourcePath], targetPath: "" },
      ]);
      await runTask(resourceTask);
      if (!jsonOut) log(`Resource pack created: ${resourceOut}`);
      produced.push(resourceOut);
    }

    // If both exist, also create mcaddon bundle.
    if (behaviorEnabled && resourceEnabled && behaviorPath && resourcePath) {
      const addonOut = resolve(buildDir, `${baseName}.mcaddon`);
      const addonTask = zipTask(addonOut, [
        { contents: [behaviorPath], targetPath: "behavior_pack" },
        { contents: [resourcePath], targetPath: "resource_pack" },
      ]);
      await runTask(addonTask);
      if (!jsonOut) log(`Mcaddon created: ${addonOut}`);
      produced.push(addonOut);
    }
    if (jsonOut) {
      console.log(JSON.stringify({ ok: true, buildDir, artifacts: produced }, null, 2));
    }
  } catch (err) {
    console.error(
      `Failed to create package: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  }
}

function runTask(task: (done: (err?: unknown) => void) => unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    };
    const maybe = task(done);
    if (maybe && typeof (maybe as Promise<unknown>).then === "function") {
      (maybe as Promise<unknown>).then(() => resolve()).catch((err) => reject(err));
    }
  });
}

async function getZipTask(): Promise<
  (outputFile: string, contents: { contents: string[]; targetPath?: string }[]) => any
> {
  // core-build-tasks exports CJS; use dynamic import to access zipTask property.
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const coreBuild = require("@minecraft/core-build-tasks");
  const task = (coreBuild as any).zipTask;
  if (!task) {
    throw new Error("zipTask not found in @minecraft/core-build-tasks");
  }
  return task;
}
