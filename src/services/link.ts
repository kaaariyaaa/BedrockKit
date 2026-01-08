import { lstat, rm, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { confirm, isCancel, multiselect, select } from "@clack/prompts";
import { createLogger } from "../core/logger.js";
import { loadConfigContext, resolveOutDir } from "../core/config.js";
import type { Lang } from "../types.js";
import type { ParsedArgsLike, ProjectInfo } from "../core/projects.js";
import {
  promptSelectProject,
  resolveProjectsByName,
} from "../core/projects.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { t } from "../utils/i18n.js";
import { runBuildWithMode } from "../commands/build.js";
import { resolveTargetPaths, type SyncTargetConfig } from "./sync-targets.js";

type ExistingMode = "skip" | "replace" | "ask";
type LinkMode = "symlink" | "junction";
type LinkSource = "dist" | "packs";
type LinkAction = "create" | "remove" | "edit";

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

function looksLikePath(input: string): boolean {
  return (
    input.includes("/") ||
    input.includes("\\") ||
    input.includes(":") ||
    input.toLowerCase().endsWith(".json")
  );
}

async function resolveLinkProject(
  parsed: ParsedArgsLike,
  lang: Lang,
  interactive: boolean,
): Promise<ProjectInfo | null> {
  const positional = parsed.positional[0] ? String(parsed.positional[0]) : undefined;
  if (positional && !looksLikePath(positional)) {
    const resolved = await resolveProjectsByName([positional], lang);
    return resolved?.[0] ?? null;
  }
  if (!interactive) return null;
  return await promptSelectProject(lang);
}

async function resolveLinkConfigPath(
  parsed: ParsedArgsLike,
  lang: Lang,
  interactive: boolean,
): Promise<string | null> {
  const configFlag = parsed.flags.config;
  if (typeof configFlag === "string" && configFlag) return configFlag;

  const positional = parsed.positional[0] ? String(parsed.positional[0]) : undefined;
  if (positional && looksLikePath(positional)) {
    const abs = resolve(process.cwd(), positional);
    if (await pathExists(abs)) return abs;
    return null;
  }

  const proj = await resolveLinkProject(parsed, lang, interactive);
  return proj?.configPath ?? null;
}

export async function runLink(
  params: {
    parsed: ParsedArgsLike;
    action: LinkAction;
    lang: Lang;
    jsonOut: boolean;
    quiet: boolean;
    dryRun: boolean;
    interactive: boolean;
  },
): Promise<boolean> {
  const { parsed, action, lang, jsonOut, quiet, dryRun, interactive } = params;
  const { info: log } = createLogger({ json: jsonOut, quiet });

  let configPath: string | null;
  try {
    configPath = await resolveLinkConfigPath(parsed, lang, interactive);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return false;
  }
  if (!configPath) {
    console.error(interactive ? t("common.cancelled", lang) : t("project.noneFound", lang));
    return false;
  }

  const configCtx = await loadConfigContext(configPath);
  const { config, rootDir } = configCtx;
  const behaviorEnabled = configCtx.behavior.enabled;
  const resourceEnabled = configCtx.resource.enabled;

  const targets = config.sync?.targets ?? {};
  const targetNames = Object.keys(targets);
  if (!targetNames.length) {
    console.error(t("link.noTargets", lang));
    return false;
  }

  let targetName = parsed.flags.target as string | undefined;
  if (!targetName) targetName = config.sync.defaultTarget;
  if (!targetName || !(targetName in targets)) {
    const choice = await select({
      message: t("link.selectTarget", lang),
      options: targetNames.map((tName) => ({ value: tName, label: tName })),
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      return false;
    }
    targetName = String(choice);
  }

  const targetConfig = targets[targetName!] as SyncTargetConfig;
  const projectName = targetConfig.projectName ?? config.project.name;
  const targetPaths = resolveTargetPaths(targetConfig, projectName);

  if (behaviorEnabled && !targetPaths.behavior) {
    console.error(t("link.targetMissingBehavior", lang, { target: targetName }));
    return false;
  }
  if (resourceEnabled && !targetPaths.resource) {
    console.error(t("link.targetMissingResource", lang, { target: targetName }));
    return false;
  }

  let source = (parsed.flags.source as string | undefined) as LinkSource | undefined;
  let mode = (parsed.flags.mode as string | undefined) as LinkMode | undefined;

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
      return false;
    }
    source = String(choice) as LinkSource;
  }
  source = source ?? "dist";

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
      return false;
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
      return false;
    }
    selected = choice as string[];
  }
  if (!selected.length) {
    if (behaviorEnabled) selected.push("behavior");
    if (resourceEnabled) selected.push("resource");
  }
  if (!selected.length) {
    console.error(t("link.noPacksSelected", lang));
    return false;
  }

  const onExistingFlag = parsed.flags["on-existing"] as string | undefined;
  let onExisting: ExistingMode = "skip";
  if (parsed.flags.force || onExistingFlag === "replace") onExisting = "replace";
  if (onExistingFlag === "skip") onExisting = "skip";
  if (!parsed.flags.force && !onExistingFlag && interactive) onExisting = "ask";
  if (action === "edit") onExisting = "replace";

  const targetsToHandle: { name: string; to: string }[] = [];
  if (selected.includes("behavior") && behaviorEnabled) {
    targetsToHandle.push({ name: "behavior", to: targetPaths.behavior! });
  }
  if (selected.includes("resource") && resourceEnabled) {
    targetsToHandle.push({ name: "resource", to: targetPaths.resource! });
  }

  if (action === "remove") {
    const removed: { to: string }[] = [];
    const skipped: { to: string; reason: string }[] = [];
    for (const { to } of targetsToHandle) {
      const existingType = await getExistingType(to);
      if (existingType === "none") {
        skipped.push({ to, reason: "not_found" });
        continue;
      }
      if (existingType !== "link") {
        skipped.push({ to, reason: "not_link" });
        continue;
      }
      if (!dryRun) {
        await rm(to, { recursive: true, force: true });
        if (!jsonOut) log(t("link.removed", lang, { path: to }));
      } else if (!jsonOut) {
        log(t("link.dryRunRemove", lang, { path: to }));
      }
      removed.push({ to });
    }
    if (jsonOut) {
      console.log(JSON.stringify({ ok: true, dryRun, removed, skipped }, null, 2));
    }
    return true;
  }

  const buildDirOverride =
    (typeof parsed.flags["build-dir"] === "string" && parsed.flags["build-dir"]) ||
    (typeof parsed.flags["out-dir"] === "string" && parsed.flags["out-dir"]) ||
    undefined;
  const buildDir = resolveOutDir(configCtx, buildDirOverride);

  const sources: { name: string; from: string; to: string }[] = [];
  if (selected.includes("behavior") && behaviorEnabled) {
    const from =
      source === "dist"
        ? resolve(buildDir, config.packs.behavior)
        : resolve(rootDir, config.packs.behavior);
    sources.push({ name: "behavior", from, to: targetPaths.behavior! });
  }
  if (selected.includes("resource") && resourceEnabled) {
    const from =
      source === "dist"
        ? resolve(buildDir, config.packs.resource)
        : resolve(rootDir, config.packs.resource);
    sources.push({ name: "resource", from, to: targetPaths.resource! });
  }

  if (source === "dist") {
    let missing = false;
    for (const { from } of sources) {
      if (!(await pathExists(from))) {
        missing = true;
        break;
      }
    }
    if (missing) {
      if (!jsonOut && !quiet) log(t("link.buildingDist", lang));
      await runBuildWithMode({
        configPath,
        outDirOverride: buildDirOverride,
        mode: "copy",
        quiet,
        jsonOut,
        lang,
      });
    }
  }
  for (const { from } of sources) {
    if (!(await pathExists(from))) {
      console.error(t("link.sourceNotFound", lang, { path: from }));
      return false;
    }
  }

  const linked: { from: string; to: string }[] = [];
  for (const { from, to } of sources) {
    const existingType = await getExistingType(to);
    let actionOnExisting = onExisting;
    if (existingType !== "none" && onExisting === "ask") {
      const replace = await confirm({
        message: t("link.confirmReplace", lang, { path: to }),
        initialValue: false,
      });
      if (isCancel(replace)) {
        console.error(t("link.cancelled", lang));
        return false;
      }
      actionOnExisting = replace ? "replace" : "skip";
    }
    if (existingType !== "none" && actionOnExisting === "skip") {
      if (!jsonOut) log(t("link.skippedExists", lang, { path: to }));
      continue;
    }
    if (!dryRun) {
      await ensureDir(dirname(to));
      if (existingType !== "none" && actionOnExisting === "replace") {
        await rm(to, { recursive: true, force: true });
      }
      const linkType = mode === "junction" ? "junction" : "dir";
      await symlink(from, to, linkType);
      if (!jsonOut) log(t("link.linked", lang, { from, to }));
    } else if (!jsonOut) {
      log(t("link.dryRunLink", lang, { from, to }));
    }
    linked.push({ from, to });
  }

  if (jsonOut) {
    console.log(JSON.stringify({ ok: true, dryRun, linked }, null, 2));
  }
  return true;
}
