import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { confirm, intro, isCancel, outro, spinner, text } from "../tui/prompts.js";
import type { BkitConfig, CommandContext, ScriptDependency } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists, writeJson } from "../utils/fs.js";
import { runInstallCommand } from "../utils/npm-install.js";
import { fetchNpmVersionChannels } from "../utils/npm.js";
import { convertJsTreeToTs } from "../utils/js-to-ts.js";
import { resolveLang, t } from "../utils/i18n.js";
import { writeLocalToolScripts } from "../utils/tooling.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";
import { writeIgnoreFiles } from "../core/scaffold.js";

type PackKind = "behavior" | "resource";

type ManifestLite = {
  format_version?: number;
  header?: { uuid?: string; name?: string; description?: string; version?: unknown };
  modules?: { type?: string; entry?: string; language?: string; uuid?: string; version?: unknown }[];
  dependencies?: ScriptDependency[];
};

async function unzip(archive: string, dest: string, lang: string): Promise<void> {
  const isWin = process.platform === "win32";
  await ensureDir(dest);
  if (isWin) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path "${archive}" -DestinationPath "${dest}" -Force`,
        ],
        { stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(t("import.extractFailed", resolveLang(lang), { code: String(code) }))),
      );
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("unzip", ["-o", archive, "-d", dest], { stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(t("import.unzipFailed", resolveLang(lang), { code: String(code) }))),
      );
    });
  }
}

async function walkForManifests(dir: string, results: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForManifests(full, results);
    } else if (entry.isFile() && entry.name.toLowerCase() === "manifest.json") {
      results.push(full);
    }
  }
  return results;
}

function classifyManifest(manifest: ManifestLite): PackKind | null {
  const modules = manifest.modules ?? [];
  if (modules.some((m) => m.type === "resources")) return "resource";
  if (modules.some((m) => m.type === "data" || m.type === "script")) return "behavior";
  return null;
}

function extractScriptInfo(manifest: ManifestLite): {
  entry?: string;
  language?: "javascript" | "typescript";
  deps?: ScriptDependency[];
} {
  const scriptModule = (manifest.modules ?? []).find((m) => m.type === "script");
  const entry = scriptModule?.entry;
  const language = scriptModule?.language === "typescript" ? "typescript" : "javascript";
  const deps = (manifest.dependencies ?? []).filter(
    (d): d is ScriptDependency =>
      typeof d === "object" &&
      d !== null &&
      "module_name" in d &&
      typeof (d as any).module_name === "string" &&
      typeof (d as any).version === "string",
  );
  return { entry, language, deps };
}

export async function handleImport(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  let archivePath = parsed.positional[0] as string | undefined;
  let projectName = parsed.flags.name as string | undefined;
  const unquote = (v: string) => v.replace(/^['"](.+)['"]$/, "$1").trim();
  const skipInstall = !!parsed.flags["skip-install"];
  const force = !!parsed.flags.force;
  const convertFlag = parsed.flags["convert-ts"];
  const noConvertFlag = parsed.flags["no-convert-ts"];
  let convertTs: boolean | undefined =
    convertFlag !== undefined ? true : noConvertFlag !== undefined ? false : undefined;
  let resolvedDeps: ScriptDependency[] = [];

  if (!archivePath) {
    const input = await text({
      message: t("import.pathPrompt", lang),
      validate: (v) => (!v.trim() ? t("import.pathRequired", lang) : undefined),
    });
    if (isCancel(input)) {
      outro(t("common.cancelled", lang));
      return;
    }
    archivePath = unquote(String(input));
  }
  archivePath = resolve(process.cwd(), unquote(archivePath));
  if (!(await pathExists(archivePath))) {
    console.error(t("import.archiveNotFound", lang, { path: archivePath }));
    process.exitCode = 1;
    return;
  }

  if (!projectName) {
    const base = basename(archivePath, extname(archivePath));
    const input = await text({
      message: t("import.projectName", lang),
      initialValue: base,
      validate: (v) => (!v.trim() ? t("import.projectNameRequired", lang) : undefined),
    });
    if (isCancel(input)) {
      outro(t("common.cancelled", lang));
      return;
    }
    projectName = unquote(String(input));
  }

  const settings = await loadSettings();
  const targetDir = resolve(resolveProjectRoot(settings), projectName);
  if (await pathExists(targetDir)) {
    if (!force) {
      const overwrite = await confirm({
        message: t("import.overwrite", lang),
        initialValue: false,
      });
      if (isCancel(overwrite) || !overwrite) {
        outro(t("common.cancelled", lang));
        return;
      }
    }
  }

  intro(t("import.intro", lang));

  // 代替ログ関数
  const logStep = (msg: string) => console.log(`◇ ${msg}`);
  const logInfo = (msg: string) => console.log(`  ${msg}`);

  const tmp = await mkdtemp(join(tmpdir(), "bkit-import-"));
  try {
    logStep(t("import.extracting", lang));
    await unzip(archivePath, tmp, lang);
    logInfo(t("import.extracted", lang));

    logStep(t("import.scanning", lang));
    const manifests = await walkForManifests(tmp);
    if (!manifests.length) {
      throw new Error(t("import.noManifestFound", lang));
    }
    let behaviorPath: string | null = null;
    let resourcePath: string | null = null;
    let scriptInfo: ReturnType<typeof extractScriptInfo> | null = null;
    for (const manifestFile of manifests) {
      try {
        const raw = await readFile(manifestFile, "utf8");
        const manifest = JSON.parse(raw) as ManifestLite;
        const kind = classifyManifest(manifest);
        if (!kind) continue;
        const manifestDir = dirname(manifestFile);
        if (kind === "behavior") {
          behaviorPath = manifestDir;
          scriptInfo = extractScriptInfo(manifest);
        } else if (kind === "resource") {
          resourcePath = manifestDir;
        }
      } catch {
        // ignore parse errors for malformed manifests
      }
    }
    logInfo(t("import.scanned", lang));

    logStep(t("import.copying", lang));
    await ensureDir(targetDir);
    if (behaviorPath) {
      await cp(behaviorPath, resolve(targetDir, "packs/behavior"), {
        recursive: true,
        force: true,
      });
    }
    if (resourcePath) {
      await cp(resourcePath, resolve(targetDir, "packs/resource"), {
        recursive: true,
        force: true,
      });
    }
    // fallback: if only one pack and it was at root, still ensure dirs exist
    await ensureDir(resolve(targetDir, "packs/behavior"));
    await ensureDir(resolve(targetDir, "packs/resource"));

    // Optional: convert scripts to TS (all .js under scripts)
    if (behaviorPath && scriptInfo?.entry?.endsWith(".js")) {
      if (convertTs === undefined) {
        const choice = await confirm({
          message: t("import.convertQuestion", lang),
          initialValue: false,
        });
        if (isCancel(choice)) {
          outro(t("common.cancelled", lang));
          return;
        }
        convertTs = !!choice;
      }
    }

    if (behaviorPath && convertTs) {
      const scriptsDir = resolve(targetDir, "packs/behavior", "scripts");
      await convertJsTreeToTs(scriptsDir);
      // Adjust entry to .ts if originally .js
      if (scriptInfo?.entry?.endsWith(".js")) {
        const tsEntry = scriptInfo.entry.replace(/\.js$/, ".ts");
        scriptInfo = { ...scriptInfo, entry: tsEntry, language: "typescript" };
      }
    }

    // build config
    const config: BkitConfig = {
      project: { name: projectName, version: "1.0.0" },
      template: "imported",
      packSelection: {
        behavior: !!behaviorPath,
        resource: !!resourcePath,
      },
      packs: {
        behavior: "packs/behavior",
        resource: "packs/resource",
      },
      build: {
        outDir: "dist",
        target: "dev",
      },
      sync: {
        defaultTarget: "gdk",
        targets: {
          gdk: {
            product: "BedrockGDK",
            projectName,
          },
        },
      },
      paths: {
        root: targetDir,
      },
      script:
        scriptInfo?.entry && behaviorPath
          ? {
              entry: scriptInfo.entry,
              language: scriptInfo.language === "typescript" ? "typescript" : "javascript",
              dependencies: scriptInfo.deps ?? [],
            }
          : undefined,
    };
    await writeJson(resolve(targetDir, "bkit.config.json"), config);

    // default ignore files
    await writeIgnoreFiles(targetDir);

    // Normalize manifest script language to javascript
    if (behaviorPath) {
      const manifestPath = resolve(targetDir, "packs/behavior/manifest.json");
      if (await pathExists(manifestPath)) {
        try {
          const raw = await readFile(manifestPath, "utf8");
          const manifest = JSON.parse(raw) as ManifestLite;
          if (Array.isArray(manifest.modules)) {
            let changed = false;
            manifest.modules = manifest.modules.map((m) => {
              if (m.type === "script" && m.language !== "javascript") {
                changed = true;
                return { ...m, language: "javascript" };
              }
              return m;
            });
            if (changed) {
              await writeJson(manifestPath, manifest);
            }
          }
        } catch {
          // ignore manifest parse errors
        }
      }
    }

    // Install dependencies if present and not skipped
    const deps = scriptInfo?.deps ?? [];
    if (deps.length && !skipInstall) {
      logStep(t("import.resolvingDeps", lang));
      for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]!;
        if (!dep.module_name || !dep.version) continue;
        logInfo(
          t("import.resolvingDep", lang, {
            name: dep.module_name,
            index: String(i + 1),
            total: String(deps.length),
          }),
        );
        const resolvedVersion = await resolveVersion(dep.module_name, dep.version);
        logInfo(
          t("import.resolvedDep", lang, { version: resolvedVersion }),
        );
        resolvedDeps.push({ module_name: dep.module_name, version: resolvedVersion });
      }
      const pkgs = resolvedDeps.map((d) => `${d.module_name}@${d.version}`);
      
      // Ensure package.json exists with dependencies
      logStep(t("import.writingPackage", lang));
      const pkgPath = resolve(targetDir, "package.json");
      const pkgJson = (await pathExists(pkgPath))
        ? JSON.parse(await readFile(pkgPath, "utf8"))
        : {
            name: projectName,
            version: "1.0.0",
            private: true,
            type: "module",
            description: t("import.packageDescription", lang),
            dependencies: {},
            devDependencies: {},
            scripts: {},
          };
      pkgJson.dependencies = pkgJson.dependencies ?? {};
      pkgJson.devDependencies = pkgJson.devDependencies ?? {};
      pkgJson.scripts = pkgJson.scripts ?? {};
      for (const dep of resolvedDeps) {
        pkgJson.dependencies[dep.module_name] = dep.version;
      }
      pkgJson.devDependencies["esbuild"] ??= "^0.24.0";
      pkgJson.devDependencies["@minecraft/core-build-tasks"] ??= "^1.1.6";
      pkgJson.scripts["build:local"] ??= "node ./tools/local-build.mjs";
      pkgJson.scripts["package:local"] ??= "node ./tools/local-package.mjs";
      await writeJson(pkgPath, pkgJson);

      // スピナーを停止してから npm install を実行（出力が正しく表示されるように）
      logStep(t("import.installingDeps", lang));
      console.log(t("import.npmRunning", lang, { packages: pkgs.join(" ") }));

      try {
        await runInstallCommand(targetDir, pkgs);
        logInfo(t("import.depsInstalled", lang));
      } catch (err) {
        console.error(t("import.depsInstallFailed", lang));
        console.error(err instanceof Error ? err.message : String(err));
      }
    } else {
      logInfo(t("import.skipInstall", lang));
    }
    // Local build/package helpers
    await writeLocalToolScripts(targetDir, config as any);

    outro(t("import.completed", lang, { path: targetDir }));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    // Ensure temporary directory is cleaned up even on failure
    if (typeof tmp === "string") {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function resolveVersion(pkg: string, requested: string): Promise<string> {
  try {
    const channels = await fetchNpmVersionChannels(pkg, { limit: 100 });
    const all = [
      ...channels.stable,
      ...channels.beta,
      ...channels.alpha,
      ...channels.preview,
      ...channels.other,
    ];
    if (all.includes(requested)) return requested;
    const prefixMatch = all.find((v) => v.startsWith(requested));
    if (prefixMatch) return prefixMatch;
    // fallback to latest available
    if (all.length) return all[0]!;
  } catch {
    // ignore and fall through
  }
  return requested;
}
