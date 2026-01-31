import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { multiselect, isCancel, outro } from "../tui/prompts.js";
import type { Manifest } from "../core/manifest.js";
import { loadConfigContext } from "../core/config.js";
import { resolveConfigPathFromArgs } from "../core/projects.js";
import {
  MANIFEST_SCRIPT_PACKAGES,
  SCRIPT_API_OPTIONS,
  SCRIPT_API_PACKAGES,
  createScriptApiVersionPicker,
} from "../core/script-api.js";
import type { CommandContext, ScriptDependency } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists, writeJson } from "../utils/fs.js";
import { runInstallCommand } from "../utils/npm-install.js";
import { resolveLang, t } from "../utils/i18n.js";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleDeps(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const interactive = !parsed.flags.yes;

  let configPath: string | null;
  try {
    configPath = await resolveConfigPathFromArgs(parsed, lang, { interactive });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (!configPath) {
    console.error(t("project.noneFound", lang));
    process.exitCode = 1;
    return;
  }

  if (!(await pathExists(configPath))) {
    console.error(t("common.configNotFound", lang, { path: configPath }));
    process.exitCode = 1;
    return;
  }

  const configCtx = await loadConfigContext(configPath);
  const { config, rootDir } = configCtx;
  if (!config.script) {
    console.error(t("deps.noScriptConfig", lang));
    process.exitCode = 1;
    return;
  }

  const packageJsonPath = resolve(rootDir, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    console.error(t("deps.packageJsonNotFound", lang, { path: packageJsonPath }));
    process.exitCode = 1;
    return;
  }

  const pkgRaw = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const deps = pkgRaw.dependencies ?? {};

  // Interactive selection (similar to init)
  const existing = new Map<string, string>();
  for (const [name, version] of Object.entries(deps)) {
    if (SCRIPT_API_PACKAGES.has(name)) {
      existing.set(name, version);
    }
  }

  const selectPackages = await multiselect({
    message: t("deps.selectPackages", lang),
    options: SCRIPT_API_OPTIONS.map((opt) => ({
      value: opt.pkg,
      label: opt.label,
      hint: opt.hint,
    })),
    initialValues: Array.from(existing.keys()).length
      ? Array.from(existing.keys())
      : ["@minecraft/server", "@minecraft/server-ui"],
  });
  if (isCancel(selectPackages)) {
    outro(t("common.cancelled", lang));
    return;
  }

  const selectedSet = new Set(selectPackages as string[]);

  const pickVersion = createScriptApiVersionPicker(lang);
  const scriptDeps: ScriptDependency[] = [];
  for (const pkg of selectedSet) {
    const picked = await pickVersion(pkg, existing.get(pkg) ?? "");
    if (picked === null) {
      outro(t("common.cancelled", lang));
      return;
    }
    scriptDeps.push({ module_name: pkg, version: picked });
  }

  const toRemove = Array.from(existing.keys()).filter((name) => !selectedSet.has(name));
  const toAdd = scriptDeps.map((d) => `${d.module_name}@${d.version}`);

  // Apply changes via npm uninstall/install so package.json と node_modules を揃える
  if (toRemove.length) {
    console.log(t("deps.npmUninstall", lang, { packages: toRemove.join(" ") }));
    await runInstallCommand(rootDir, [], { cmd: "npm", args: ["uninstall", ...toRemove] });
  }
  if (toAdd.length) {
    console.log(t("deps.npmInstall", lang, { packages: toAdd.join(" ") }));
    await runInstallCommand(rootDir, toAdd);
  }
  if (!toRemove.length && !toAdd.length) {
    console.log(t("deps.noChanges", lang));
  }

  // Update config script deps and apiVersion (use @minecraft/server if present).
  config.script.dependencies = scriptDeps;
  const serverDep = scriptDeps.find((d) => d.module_name === "@minecraft/server");
  if (serverDep) {
    config.script.apiVersion = serverDep.version;
  }

  // Update behavior manifest dependencies to match (excluding math/vanilla-data).
  const behaviorManifestPath = configCtx.behavior.path
    ? resolve(configCtx.behavior.path, "manifest.json")
    : resolve(rootDir, config.packs.behavior, "manifest.json");
  if (!(await pathExists(behaviorManifestPath))) {
    console.error(t("deps.behaviorManifestNotFound", lang, { path: behaviorManifestPath }));
    process.exitCode = 1;
    return;
  }
  const behaviorManifest = await readManifest(behaviorManifestPath);
  const filteredDeps = scriptDeps.filter((d) => MANIFEST_SCRIPT_PACKAGES.has(d.module_name));
  behaviorManifest.dependencies = [
    ...(behaviorManifest.dependencies ?? []).filter(
      (d) => !("module_name" in d && MANIFEST_SCRIPT_PACKAGES.has(d.module_name)),
    ),
    ...filteredDeps,
  ];

  await writeJson(packageJsonPath, pkgRaw);
  await writeJson(configPath, config);
  await writeJson(behaviorManifestPath, behaviorManifest);

  console.log(t("deps.updated", lang));
}
