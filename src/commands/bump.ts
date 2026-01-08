import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { select, text, isCancel, outro } from "@clack/prompts";
import type { Manifest, ManifestDependency } from "../core/manifest.js";
import { loadConfigContext } from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists, writeJson } from "../utils/fs.js";
import {
  BumpLevel,
  bumpTuple,
  bumpVersionString,
  stringToVersionTuple,
} from "../utils/version.js";
import { resolveLang, t } from "../utils/i18n.js";
import { promptSelectProject, resolveProjectsByName } from "../core/projects.js";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

function updateManifestVersion(manifest: Manifest, nextVersionTuple: [number, number, number]) {
  manifest.header.version = nextVersionTuple;
  manifest.modules = manifest.modules.map((m) =>
    m.type === "script" ? m : { ...m, version: nextVersionTuple },
  );
  if (manifest.dependencies) {
    manifest.dependencies = manifest.dependencies.map((dep): ManifestDependency => {
      if ("uuid" in dep) {
        return { ...dep, version: nextVersionTuple };
      }
      return dep;
    });
  }
}

export async function handleBump(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const projectArg = parsed.positional[0] ? String(parsed.positional[0]) : undefined;
  const level = (parsed.positional[1] as BumpLevel | undefined) ?? "patch";
  const toVersion = (parsed.flags.to as string | undefined) ?? (parsed.flags.set as string | undefined);
  const minEngine = parsed.flags["min-engine"] as string | undefined;
  const nonInteractive = !!parsed.flags.yes;

  const configFlag = parsed.flags.config as string | undefined;
  let configPath: string | undefined;
  if (configFlag) {
    configPath = configFlag;
  } else if (projectArg) {
    const resolved = await resolveProjectsByName([projectArg], lang);
    configPath = resolved?.[0]?.configPath;
  } else if (!nonInteractive) {
    const picked = await promptSelectProject(lang);
    if (!picked) {
      console.error(t("common.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    configPath = picked.configPath;
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

  let nextVersionString = toVersion ? String(toVersion) : undefined;
  let nextLevel = level;
  let nextMinEngineInput = minEngine;

  if (!nonInteractive && !nextVersionString && parsed.positional.length < 2) {
    const choice = await select({
      message: t("bump.selectType", lang),
      options: [
        { value: "patch", label: t("bump.option.patch", lang) },
        { value: "minor", label: t("bump.option.minor", lang) },
        { value: "major", label: t("bump.option.major", lang) },
        { value: "custom", label: t("bump.option.custom", lang) },
      ],
      initialValue: "patch",
    });
    if (isCancel(choice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    if (choice === "custom") {
      const input = await text({
        message: t("bump.enterVersion", lang),
        initialValue: config.project.version,
        validate: (v) => (!v.trim() ? t("bump.versionRequired", lang) : undefined),
      });
      if (isCancel(input)) {
        outro(t("common.cancelled", lang));
        return;
      }
      nextVersionString = String(input).trim();
    } else {
      nextLevel = choice as BumpLevel;
    }
  }

  if (!nonInteractive && !nextMinEngineInput) {
    const choice = await select({
      message: t("bump.updateMinEngine", lang),
      options: [
        { value: "keep", label: t("bump.keepCurrent", lang) },
        { value: "set", label: t("bump.setMinEngine", lang) },
      ],
      initialValue: "keep",
    });
    if (isCancel(choice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    if (choice === "set") {
      const input = await text({
        message: t("bump.enterMinEngine", lang),
        initialValue: "1.21.0",
        validate: (v) =>
          !/^\d+\.\d+\.\d+$/.test(v.trim())
            ? t("bump.minEngineFormat", lang)
            : undefined,
      });
      if (isCancel(input)) {
        outro(t("common.cancelled", lang));
        return;
      }
      nextMinEngineInput = String(input).trim();
    }
  }

  const nextVersion =
    nextVersionString ??
    bumpVersionString(config.project.version, nextLevel as BumpLevel);
  const nextVersionTuple = stringToVersionTuple(nextVersion);

  let nextMinEngineTuple: [number, number, number] | undefined;
  if (nextMinEngineInput) {
    nextMinEngineTuple = stringToVersionTuple(nextMinEngineInput);
  }

  config.project.version = nextVersion;

  const behaviorManifestPath = configCtx.behavior.path
    ? resolve(configCtx.behavior.path, "manifest.json")
    : resolve(rootDir, config.packs.behavior, "manifest.json");
  const resourceManifestPath = configCtx.resource.path
    ? resolve(configCtx.resource.path, "manifest.json")
    : resolve(rootDir, config.packs.resource, "manifest.json");

  if (!(await pathExists(behaviorManifestPath))) {
    console.error(t("bump.behaviorManifestMissing", lang, { path: behaviorManifestPath }));
    process.exitCode = 1;
    return;
  }
  if (!(await pathExists(resourceManifestPath))) {
    console.error(t("bump.resourceManifestMissing", lang, { path: resourceManifestPath }));
    process.exitCode = 1;
    return;
  }

  const behaviorManifest = await readManifest(behaviorManifestPath);
  const resourceManifest = await readManifest(resourceManifestPath);

  updateManifestVersion(behaviorManifest, nextVersionTuple);
  updateManifestVersion(resourceManifest, nextVersionTuple);
  if (nextMinEngineTuple) {
    behaviorManifest.header.min_engine_version = nextMinEngineTuple;
    resourceManifest.header.min_engine_version = nextMinEngineTuple;
  }

  await writeJson(configPath, config);
  await writeJson(behaviorManifestPath, behaviorManifest);
  await writeJson(resourceManifestPath, resourceManifest);

  const minSuffix = nextMinEngineTuple
    ? t("bump.minEngineSuffix", lang, { value: nextMinEngineTuple.join(".") })
    : "";
  console.log(
    nextVersionString
      ? t("bump.doneSet", lang, {
          version: nextVersion,
          minEngine: minSuffix,
        })
      : t("bump.doneBumped", lang, {
          level: nextLevel,
          version: nextVersion,
          minEngine: minSuffix,
        }),
  );
}
