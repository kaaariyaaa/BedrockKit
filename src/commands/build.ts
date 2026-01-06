import { rm, cp, stat } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { spawn } from "node:child_process";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveConfigPath, resolveOutDir } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { loadIgnoreRules, isIgnored } from "../utils/ignore.js";
import { resolveLang } from "../utils/i18n.js";

function shouldSkipTsScript(entryRel: string, scriptEntry: string | undefined, src: string, root: string): boolean {
  if (!scriptEntry) return false;
  const rel = relative(root, src).replace(/\\/g, "/");
  return rel.startsWith(entryRel) && rel.endsWith(".ts");
}

export async function handleBuild(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const { info: log } = createLogger({ json: jsonOut, quiet });
  const outDirOverride =
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    (typeof parsed.flags.outdir === "string" && parsed.flags.outdir) ||
    undefined;
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
  const { config, rootDir } = configCtx;
  const ignoreRules = await loadIgnoreRules(rootDir);

  const outDir = resolveOutDir(configCtx, outDirOverride);
  const behaviorEnabled = configCtx.behavior.enabled;
  const resourceEnabled = configCtx.resource.enabled;
  const behaviorSrc = configCtx.behavior.path;
  const resourceSrc = configCtx.resource.path;
  const behaviorDest = behaviorSrc ? resolve(outDir, config.packs.behavior) : null;
  const resourceDest = resourceSrc ? resolve(outDir, config.packs.resource) : null;

  await rm(outDir, { recursive: true, force: true });

  const scriptEntryRel = config.script?.entry;
  // ESLint (if script present)
  if (behaviorEnabled && config.script) {
    try {
      await runEslint(rootDir, quiet || jsonOut);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
      return;
    }
  }
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
    log(`Bundling script: ${entryAbs} -> ${outFile}`);
    await runTask(bundle);
  }

  // Copy behavior pack, skipping TS script source if a bundle was produced.
  if (behaviorEnabled && behaviorSrc && behaviorDest) {
    await ensureDir(dirname(behaviorDest));
    await cp(behaviorSrc, behaviorDest, {
      recursive: true,
      force: true,
      filter: (src) =>
        !isIgnored(src, rootDir, ignoreRules) &&
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
    await cp(resourceSrc, resourceDest, {
      recursive: true,
      force: true,
      filter: (src) => !isIgnored(src, rootDir, ignoreRules),
    });
  }

  // Optionally ensure outDir exists if packs missing.
  await ensureDir(outDir);

  const outStat = await stat(outDir);
  if (!outStat.isDirectory()) {
    console.error(`Build output is not a directory: ${outDir}`);
    process.exitCode = 1;
    return;
  }

  if (jsonOut) {
    console.log(JSON.stringify({ ok: true, outDir }, null, 2));
  } else {
    log(`Build completed -> ${outDir}`);
  }
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

async function runEslint(rootDir: string, quiet: boolean): Promise<void> {
  const eslintPath = resolve(rootDir, "node_modules/.bin/eslint");
  if (!(await pathExists(eslintPath))) {
    throw new Error("eslint not found in project. Run npm install.");
  }
  const args = ["packs/behavior/scripts/**/*.{ts,js}"];
  const useShell = process.platform === "win32";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(eslintPath, args, {
      cwd: rootDir,
      stdio: quiet ? "ignore" : "inherit",
      shell: useShell,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`eslint exited with code ${code}`));
    });
  });
}
