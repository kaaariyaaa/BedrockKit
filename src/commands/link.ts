import { lstat, rm, symlink } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { createRequire } from "node:module";
import { select, multiselect, confirm, isCancel } from "@clack/prompts";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveConfigPath, resolveOutDir } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { resolveLang, t } from "../utils/i18n.js";

type ExistingMode = "skip" | "replace" | "ask";
type LinkMode = "symlink" | "junction";
type LinkSource = "dist" | "packs";

const DEVELOPMENT_BEHAVIOR = "development_behavior_packs";
const DEVELOPMENT_RESOURCE = "development_resource_packs";

async function getExistingType(path: string): Promise<"none" | "link" | "dir" | "file"> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) return "link";
    if (stat.isDirectory()) return "dir";
    return "file";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "none";
    throw err;
  }
}

function resolveTargetPaths(
  target: { behavior?: string; resource?: string; product?: string; projectName?: string },
  projectName: string,
): { behavior?: string; resource?: string } {
  if (target.behavior || target.resource) {
    return { behavior: target.behavior, resource: target.resource };
  }
  if (!target.product) return {};
  const require = createRequire(import.meta.url);
  const coreBuild = require("@minecraft/core-build-tasks");
  const getGameDeploymentRootPaths = (coreBuild as any).getGameDeploymentRootPaths as
    | (() => Record<string, string | undefined>)
    | undefined;
  if (!getGameDeploymentRootPaths) return {};
  const rootPaths = getGameDeploymentRootPaths();
  const root = rootPaths[target.product];
  if (!root) return {};
  return {
    behavior: join(root, DEVELOPMENT_BEHAVIOR, projectName),
    resource: join(root, DEVELOPMENT_RESOURCE, projectName),
  };
}

export async function handleLink(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const dryRun = !!parsed.flags["dry-run"];
  const interactive = !jsonOut && !quiet && !parsed.flags.yes;
  const { info: log } = createLogger({ json: jsonOut, quiet });

  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    console.error(t("link.cancelled", lang));
    process.exitCode = 1;
    return;
  }

  const configCtx = await loadConfigContext(configPath);
  const { config, rootDir } = configCtx;
  const behaviorEnabled = configCtx.behavior.enabled;
  const resourceEnabled = configCtx.resource.enabled;

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
  if (!targetName) targetName = config.sync.defaultTarget;
  if (!targetName || !(targetName in targets)) {
    const choice = await select({
      message: t("link.selectTarget", lang),
      options: targetNames.map((t) => ({ value: t, label: t })),
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    targetName = String(choice);
  }

  const targetConfig = targets[targetName!];
  const projectName = targetConfig.projectName ?? config.project.name;
  const targetPaths = resolveTargetPaths(targetConfig, projectName);

  if (behaviorEnabled && !targetPaths.behavior) {
    console.error(`Target '${targetName}' missing behavior path in sync.targets`);
    process.exitCode = 1;
    return;
  }
  if (resourceEnabled && !targetPaths.resource) {
    console.error(`Target '${targetName}' missing resource path in sync.targets`);
    process.exitCode = 1;
    return;
  }

  let source = (parsed.flags.source as string | undefined) as LinkSource | undefined;
  if (!source && interactive) {
    const choice = await select({
      message: t("link.selectSource", lang),
      options: [
        { value: "dist", label: t("link.source.dist", lang) },
        { value: "packs", label: t("link.source.packs", lang) },
      ],
      initialValue: "dist",
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    source = String(choice) as LinkSource;
  }
  source = source ?? "dist";

  let mode = (parsed.flags.mode as string | undefined) as LinkMode | undefined;
  if (!mode && interactive) {
    const choice = await select({
      message: t("link.selectMode", lang),
      options: [
        { value: "junction", label: t("link.mode.junction", lang) },
        { value: "symlink", label: t("link.mode.symlink", lang) },
      ],
      initialValue: process.platform === "win32" ? "junction" : "symlink",
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    mode = String(choice) as LinkMode;
  }
  mode = mode ?? (process.platform === "win32" ? "junction" : "symlink");

  let selected: string[] = [];
  if (parsed.flags.behavior) selected.push("behavior");
  if (parsed.flags.resource) selected.push("resource");
  if (!selected.length && interactive) {
    const options = [];
    if (behaviorEnabled) options.push({ value: "behavior", label: t("init.pack.behavior", lang) });
    if (resourceEnabled) options.push({ value: "resource", label: t("init.pack.resource", lang) });
    const choice = await multiselect({
      message: t("link.selectPacks", lang),
      options,
      initialValues: options.map((o) => o.value as string),
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    selected = choice as string[];
  }
  if (!selected.length) {
    if (behaviorEnabled) selected.push("behavior");
    if (resourceEnabled) selected.push("resource");
  }
  if (!selected.length) {
    console.error("No packs selected.");
    process.exitCode = 1;
    return;
  }

  const onExistingFlag = parsed.flags["on-existing"] as string | undefined;
  let onExisting: ExistingMode = "skip";
  if (parsed.flags.force || onExistingFlag === "replace") onExisting = "replace";
  if (onExistingFlag === "skip") onExisting = "skip";
  if (!parsed.flags.force && !onExistingFlag && interactive) onExisting = "ask";

  const buildDirOverride =
    (typeof parsed.flags["build-dir"] === "string" && parsed.flags["build-dir"]) ||
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    undefined;
  const buildDir = resolveOutDir(configCtx, buildDirOverride);

  const sources: { name: string; from: string; to: string }[] = [];
  if (selected.includes("behavior") && behaviorEnabled) {
    const from = source === "dist"
      ? resolve(buildDir, config.packs.behavior)
      : resolve(rootDir, config.packs.behavior);
    sources.push({ name: "behavior", from, to: targetPaths.behavior! });
  }
  if (selected.includes("resource") && resourceEnabled) {
    const from = source === "dist"
      ? resolve(buildDir, config.packs.resource)
      : resolve(rootDir, config.packs.resource);
    sources.push({ name: "resource", from, to: targetPaths.resource! });
  }

  for (const { from } of sources) {
    if (!(await pathExists(from))) {
      console.error(`Source path not found: ${from}`);
      process.exitCode = 1;
      return;
    }
  }

  const linked: { from: string; to: string }[] = [];
  for (const { from, to } of sources) {
    const existingType = await getExistingType(to);
    let action = onExisting;
    if (existingType !== "none" && onExisting === "ask") {
      const replace = await confirm({
        message: t("link.confirmReplace", lang, { path: to }),
        initialValue: false,
      });
      if (isCancel(replace)) {
        console.error(t("link.cancelled", lang));
        process.exitCode = 1;
        return;
      }
      action = replace ? "replace" : "skip";
    }
    if (existingType !== "none" && action === "skip") {
      if (!jsonOut) log(`Skipped ${to} (already exists).`);
      continue;
    }
    if (!dryRun) {
      await ensureDir(dirname(to));
      if (existingType !== "none" && action === "replace") {
        await rm(to, { recursive: true, force: true });
      }
      const linkType = mode === "junction" ? "junction" : "dir";
      await symlink(from, to, linkType);
      if (!jsonOut) log(`Linked ${from} -> ${to}`);
    } else if (!jsonOut) {
      log(`[dry-run] Would link ${from} -> ${to}`);
    }
    linked.push({ from, to });
  }

  if (jsonOut) {
    console.log(JSON.stringify({ ok: process.exitCode !== 1, dryRun, linked }, null, 2));
  }
}
