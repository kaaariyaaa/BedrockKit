import { rm, cp, stat, readdir, lstat, symlink } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveOutDir } from "../core/config.js";
import { resolveProjectsFromArgs } from "../core/projects.js";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { loadIgnoreRules, isIgnored } from "../utils/ignore.js";
import { resolveLang, t } from "../utils/i18n.js";

function shouldSkipTsScript(
  entryRel: string,
  scriptEntry: string | undefined,
  src: string,
  root: string,
): boolean {
  if (!scriptEntry) return false;
  const rel = relative(root, src).replace(/\\/g, "/");
  return rel.startsWith(entryRel) && rel.endsWith(".ts");
}

type BuildMode = "copy" | "link";

type BuildOptions = {
  configPath: string;
  outDirOverride?: string;
  mode: BuildMode;
  quiet?: boolean;
  jsonOut?: boolean;
  lang?: Lang;
};

export async function handleBuild(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const interactive = !jsonOut && !quiet && !parsed.flags.yes;
  const outDirOverride =
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    (typeof parsed.flags.outdir === "string" && parsed.flags.outdir) ||
    undefined;

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
    await runBuildWithMode({
      configPath: proj.configPath,
      outDirOverride,
      mode: "copy",
      quiet,
      jsonOut,
      lang,
    });
  }
}

export async function runBuildWithMode(options: BuildOptions): Promise<void> {
  const { configPath, outDirOverride, mode, quiet, jsonOut } = options;
  const resolvedLang = options.lang ?? resolveLang();
  const { info: log } = createLogger({ json: jsonOut, quiet });

  if (!(await pathExists(configPath))) {
    console.error(t("common.configNotFound", resolvedLang, { path: configPath }));
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

  const scriptConfig = config.script;
  const scriptEntryRel = scriptConfig?.entry;
  // ESLint (if script present)
  if (behaviorEnabled && scriptConfig) {
    try {
      await runEslint(rootDir, Boolean(quiet || jsonOut), resolvedLang);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
      return;
    }
  }
  const shouldBundle =
    behaviorEnabled &&
    scriptConfig &&
    scriptEntryRel &&
    (scriptConfig.language === "typescript" || scriptEntryRel.endsWith(".ts"));
  if (shouldBundle) {
    const entryAbs = resolve(behaviorSrc!, scriptEntryRel);
    const outFile = resolve(
      behaviorDest!,
      scriptEntryRel.replace(/\.ts$/, ".js"),
    );
    await ensureDir(dirname(outFile));
    const bundleTask = await getBundleTask(resolvedLang);
    const externals =
      scriptConfig.dependencies
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
    log(t("build.bundling", resolvedLang, { entry: entryAbs, out: outFile }));
    await runTask(bundle);
  }

  if (mode === "copy") {
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
  } else {
    // Link behavior/resource packs (lighter build)
    if (behaviorEnabled && behaviorSrc && behaviorDest) {
      await ensureDir(behaviorDest);
      const hasTsScripts = await hasTypeScriptScripts(behaviorSrc);
      const excludeScripts =
        (scriptConfig &&
          scriptEntryRel &&
          (scriptConfig.language === "typescript" || scriptEntryRel.endsWith(".ts"))) ||
        hasTsScripts;
      await linkEntries(
        behaviorSrc,
        behaviorDest,
        rootDir,
        ignoreRules,
        excludeScripts ? new Set(["scripts"]) : undefined,
      );
      if (excludeScripts && scriptEntryRel) {
        await ensureDir(resolve(behaviorDest, dirname(scriptEntryRel)));
      }
    }

    if (resourceEnabled && resourceSrc && resourceDest) {
      await ensureDir(resourceDest);
      await linkEntries(resourceSrc, resourceDest, rootDir, ignoreRules);
    }
  }

  // Optionally ensure outDir exists if packs missing.
  await ensureDir(outDir);

  const outStat = await stat(outDir);
  if (!outStat.isDirectory()) {
    console.error(t("build.outputNotDir", resolvedLang, { path: outDir }));
    process.exitCode = 1;
    return;
  }

  if (jsonOut) {
    console.log(JSON.stringify({ ok: true, outDir, mode }, null, 2));
  } else {
    log(t("build.completed", resolvedLang, { mode, outDir }));
  }
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

type ScriptBuildOptions = {
  configPath: string;
  outDirOverride?: string;
  quiet?: boolean;
  jsonOut?: boolean;
  lang?: Lang;
};

export async function runScriptBuildOnly(options: ScriptBuildOptions): Promise<void> {
  const { configPath, outDirOverride, quiet, jsonOut, lang } = options;
  const { info: log } = createLogger({ json: jsonOut, quiet });
  const resolvedLang = lang ?? "ja";

  if (!(await pathExists(configPath))) {
    console.error(t("common.configNotFound", resolvedLang, { path: configPath }));
    process.exitCode = 1;
    return;
  }

  const configCtx = await loadConfigContext(configPath);
  const { config, rootDir } = configCtx;
  const ignoreRules = await loadIgnoreRules(rootDir);
  const behaviorEnabled = configCtx.behavior.enabled;
  const behaviorSrc = configCtx.behavior.path;
  const scriptConfig = config.script;
  const scriptEntryRel = scriptConfig?.entry;

  if (!behaviorEnabled || !behaviorSrc || !scriptConfig || !scriptEntryRel) {
    return;
  }

  const shouldBundle =
    scriptConfig.language === "typescript" || scriptEntryRel.endsWith(".ts");
  if (!shouldBundle) {
    return;
  }

  const outDir = resolveOutDir(configCtx, outDirOverride);
  const behaviorDest = resolve(outDir, config.packs.behavior);
  const scriptsOutDir = resolve(behaviorDest, "scripts");

  try {
    await runEslint(rootDir, Boolean(quiet || jsonOut), resolvedLang);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  await rm(scriptsOutDir, { recursive: true, force: true });

  const entryAbs = resolve(behaviorSrc, scriptEntryRel);
  const outFile = resolve(
    behaviorDest,
    scriptEntryRel.replace(/\.ts$/, ".js"),
  );
  await ensureDir(dirname(outFile));
  const bundleTask = await getBundleTask(resolvedLang);
  const externals =
    scriptConfig.dependencies
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
  log(t("build.bundling", resolvedLang, { entry: entryAbs, out: outFile }));
  await runTask(bundle);

  // Keep ignore rules loaded to match build behavior, even though we only emit scripts.
  void ignoreRules;
}

async function getBundleTask(lang: Lang): Promise<
  (options: {
    entryPoint: string;
    outfile: string;
    sourcemap?: boolean | "linked" | "inline" | "external" | "both";
    external?: string[];
    minifyWhitespace?: boolean;
  }) => (done: (err?: unknown) => void) => unknown
> {
  const require = createRequire(import.meta.url);
  const coreBuild = require("@minecraft/core-build-tasks");
  const task = (coreBuild as any).bundleTask;
  if (!task) {
    throw new Error(t("build.bundleTaskMissing", lang));
  }
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

async function runEslint(rootDir: string, quiet: boolean, lang: Lang): Promise<void> {
  const eslintPath = resolve(rootDir, "node_modules/.bin/eslint");
  if (!(await pathExists(eslintPath))) {
    throw new Error(t("build.eslintMissing", lang));
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
      else reject(new Error(t("build.eslintExit", lang, { code: String(code) })));
    });
  });
}
