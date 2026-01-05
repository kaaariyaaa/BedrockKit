import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { multiselect, select, text, isCancel, outro } from "@clack/prompts";
import { loadConfig } from "../config.js";
import type { CommandContext, ScriptDependency } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists, writeJson } from "../utils/fs.js";
import { resolveConfigPath } from "../utils/config-discovery.js";
import type { Manifest } from "../manifest.js";
import { fetchNpmVersionChannels } from "../utils/npm.js";
import { runInstallCommand } from "../utils/npm-install.js";
import { resolveLang, t } from "../utils/i18n.js";

const SCRIPT_API_PACKAGES = new Set([
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/common",
  "@minecraft/math",
  "@minecraft/server-net",
  "@minecraft/server-gametest",
  "@minecraft/server-admin",
  "@minecraft/debug-utilities",
  "@minecraft/vanilla-data",
]);

const MANIFEST_SCRIPT_PACKAGES = new Set([
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/common",
  "@minecraft/server-net",
  "@minecraft/server-gametest",
  "@minecraft/server-admin",
  "@minecraft/debug-utilities",
]);

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleDeps(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    console.error(t("common.cancelled", lang));
    process.exitCode = 1;
    return;
  }

  if (!(await pathExists(configPath))) {
    console.error(`Config not found: ${configPath}`);
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(configPath);
  if (!config.script) {
    console.error("No script configuration found in bkit.config.json.");
    process.exitCode = 1;
    return;
  }

  const configDir = dirname(configPath);
  const rootDir = config.paths?.root ? resolve(configDir, config.paths.root) : configDir;
  const packageJsonPath = resolve(rootDir, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    console.error(`package.json not found: ${packageJsonPath}`);
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
    options: [
      { value: "@minecraft/server", label: "@minecraft/server", hint: "Core Script API" },
      { value: "@minecraft/server-ui", label: "@minecraft/server-ui", hint: "UI helpers" },
      { value: "@minecraft/common", label: "@minecraft/common", hint: "Shared utilities" },
      { value: "@minecraft/math", label: "@minecraft/math", hint: "Math helpers" },
      { value: "@minecraft/server-net", label: "@minecraft/server-net", hint: "Net helpers" },
      { value: "@minecraft/server-gametest", label: "@minecraft/server-gametest", hint: "Gametest API" },
      { value: "@minecraft/server-admin", label: "@minecraft/server-admin", hint: "Admin API" },
      { value: "@minecraft/debug-utilities", label: "@minecraft/debug-utilities", hint: "Debug helpers" },
      { value: "@minecraft/vanilla-data", label: "@minecraft/vanilla-data", hint: "Vanilla constants" },
    ],
    initialValues: Array.from(existing.keys()).length
      ? Array.from(existing.keys())
      : ["@minecraft/server", "@minecraft/server-ui"],
  });
  if (isCancel(selectPackages)) {
    outro(t("common.cancelled", lang));
    return;
  }

  const selectedSet = new Set(selectPackages as string[]);

  const cached = new Map<string, { channel: string; versions: string[] }>();
  const pickVersion = async (pkg: string, current: string): Promise<string | null> => {
    if (!cached.has(pkg)) {
      const channels = await fetchNpmVersionChannels(pkg, { limit: 15 });
      cached.set(pkg, {
        channel: "stable",
        versions: channels.stable.length
          ? channels.stable
          : [...channels.beta, ...channels.alpha, ...channels.preview, ...channels.other],
      });
      cached.set(`${pkg}:beta`, { channel: "beta", versions: channels.beta });
      cached.set(`${pkg}:alpha`, { channel: "alpha", versions: channels.alpha });
      cached.set(`${pkg}:preview`, { channel: "preview", versions: channels.preview });
      cached.set(`${pkg}:other`, { channel: "other", versions: channels.other });
    }

    const channelChoice = await select({
      message: t("init.selectChannel", lang, { pkg }),
      options: [
        { value: "stable", label: "stable" },
        { value: "beta", label: "beta" },
        { value: "alpha", label: "alpha" },
        { value: "preview", label: "preview" },
        { value: "other", label: "other" },
        { value: "__manual__", label: t("common.enterManually", lang) },
      ],
      initialValue: "stable",
    });
    if (isCancel(channelChoice)) return null;

    if (channelChoice === "__manual__") {
      const manual = await text({
        message: t("init.selectVersion", lang, { pkg, channel: "manual" }),
        initialValue: current,
        validate: (v) => (!v.trim() ? t("common.required", lang) : undefined),
      });
      return isCancel(manual) ? null : manual.trim();
    }

    const bucket = channelChoice === "stable" ? cached.get(pkg) : cached.get(`${pkg}:${channelChoice}`);
    const versions = bucket?.versions ?? [];
    const choice = await select({
      message: t("init.selectVersion", lang, { pkg, channel: String(channelChoice) }),
      options: [
        ...versions.map((v) => ({ value: v, label: v })),
        { value: "__manual__", label: t("common.enterManually", lang) },
      ],
      initialValue: versions[0] ?? current,
    });
    if (isCancel(choice)) return null;
    if (choice === "__manual__") {
      const manual = await text({
        message: t("init.selectVersion", lang, { pkg, channel: "manual" }),
        initialValue: current,
        validate: (v) => (!v.trim() ? t("common.required", lang) : undefined),
      });
      return isCancel(manual) ? null : manual.trim();
    }
    return String(choice);
  };

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
    console.log(`npm uninstall ${toRemove.join(" ")}`);
    await runInstallCommand(rootDir, [], { cmd: "npm", args: ["uninstall", ...toRemove] });
  }
  if (toAdd.length) {
    console.log(`npm install ${toAdd.join(" ")}`);
    await runInstallCommand(rootDir, toAdd);
  }
  if (!toRemove.length && !toAdd.length) {
    console.log("No changes to npm dependencies.");
  }

  // Update config script deps and apiVersion (use @minecraft/server if present).
  config.script.dependencies = scriptDeps;
  const serverDep = scriptDeps.find((d) => d.module_name === "@minecraft/server");
  if (serverDep) {
    config.script.apiVersion = serverDep.version;
  }

  // Update behavior manifest dependencies to match (excluding math/vanilla-data).
  const behaviorManifestPath = resolve(rootDir, config.packs.behavior, "manifest.json");
  if (!(await pathExists(behaviorManifestPath))) {
    console.error(`Behavior manifest not found: ${behaviorManifestPath}`);
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
