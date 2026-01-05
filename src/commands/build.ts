import { rm, cp, stat } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { loadConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { resolveConfigPath } from "../utils/config-discovery.js";

function shouldSkipTsScript(entryRel: string, scriptEntry: string | undefined, src: string, root: string): boolean {
  if (!scriptEntry) return false;
  const rel = relative(root, src).replace(/\\/g, "/");
  return rel.startsWith(entryRel) && rel.endsWith(".ts");
}

export async function handleBuild(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined);
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

  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);
  const rootDir = config.paths?.root
    ? resolve(configDir, config.paths.root)
    : configDir;

  const outDir = resolve(rootDir, config.build?.outDir ?? "dist");
  const behaviorEnabled = config.packSelection?.behavior !== false;
  const resourceEnabled = config.packSelection?.resource !== false;
  const behaviorSrc = behaviorEnabled ? resolve(rootDir, config.packs.behavior) : null;
  const resourceSrc = resourceEnabled ? resolve(rootDir, config.packs.resource) : null;
  const behaviorDest = behaviorSrc ? resolve(outDir, config.packs.behavior) : null;
  const resourceDest = resourceSrc ? resolve(outDir, config.packs.resource) : null;

  await rm(outDir, { recursive: true, force: true });

  const scriptEntryRel = config.script?.entry;
  if (behaviorEnabled && config.script && scriptEntryRel) {
    const entryAbs = resolve(behaviorSrc!, scriptEntryRel);
    const outFile = resolve(
      behaviorDest!,
      scriptEntryRel.replace(/\.ts$/, ".js"),
    );
    await ensureDir(dirname(outFile));
    const bundleTask = await getBundleTask();
    const externals =
      config.script.dependencies
        ?.filter(
          (d) =>
            d.module_name !== "@minecraft/math" && d.module_name !== "@minecraft/vanilla-data",
        )
        .map((d) => d.module_name) ?? [];
    const bundle = bundleTask({
      entryPoint: entryAbs,
      outfile: outFile,
      sourcemap: true,
      external: externals,
      minifyWhitespace: false,
    });
    console.log(`Bundling script: ${entryAbs} -> ${outFile}`);
    await runTask(bundle);
  }

  // Copy behavior pack, skipping TS script source if a bundle was produced.
  if (behaviorEnabled && behaviorSrc && behaviorDest) {
    await ensureDir(dirname(behaviorDest));
    await cp(behaviorSrc, behaviorDest, {
      recursive: true,
      force: true,
      filter: (src) =>
        !shouldSkipTsScript(
          scriptEntryRel ? dirname(scriptEntryRel).replace(/\\/g, "/") : "",
          scriptEntryRel,
          src,
          behaviorSrc,
        ),
    });
  }

  // Copy resource pack as-is.
  if (resourceEnabled && resourceSrc && resourceDest) {
    await ensureDir(dirname(resourceDest));
    await cp(resourceSrc, resourceDest, { recursive: true, force: true });
  }

  // Optionally ensure outDir exists if packs missing.
  await ensureDir(outDir);

  const outStat = await stat(outDir);
  if (!outStat.isDirectory()) {
    console.error(`Build output is not a directory: ${outDir}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Build completed -> ${outDir}`);
}

async function getBundleTask(): Promise<
  (options: {
    entryPoint: string;
    outfile: string;
    sourcemap?: boolean | "linked" | "inline" | "external" | "both";
    external?: string[];
    minifyWhitespace?: boolean;
  }) => (done: (err?: unknown) => void) => unknown
> {
  const coreBuild = await import("@minecraft/core-build-tasks");
  const task = (coreBuild as any).bundleTask;
  if (!task) throw new Error("bundleTask not found in @minecraft/core-build-tasks");
  return task;
}

function runTask(task: (done: (err?: unknown) => void) => unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    };
    const maybePromise = task(done);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
      (maybePromise as Promise<unknown>).then(() => resolve()).catch((err) => reject(err));
    }
  });
}
