import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { Manifest } from "../core/manifest.js";
import {
  loadConfigContext,
  validateConfig,
} from "../core/config.js";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { resolveLang, t } from "../utils/i18n.js";
import { promptSelectProject, resolveProjectsByName } from "../core/projects.js";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleValidate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const strict = !!parsed.flags.strict;
  const jsonOut = !!parsed.flags.json;
  const interactive = !jsonOut && !parsed.flags.yes;
  const issues: string[] = [];

  const configFlag = parsed.flags.config as string | undefined;
  let configPath: string | undefined;
  if (configFlag) {
    configPath = configFlag;
  } else {
    const projectArg = parsed.positional[0] ? String(parsed.positional[0]) : undefined;
    if (projectArg) {
      const resolved = await resolveProjectsByName([projectArg], lang);
      configPath = resolved?.[0]?.configPath;
    } else if (interactive) {
      const picked = await promptSelectProject(lang);
      if (!picked) {
        issues.push(t("common.cancelled", lang));
        report(issues, lang, { json: jsonOut });
        return;
      }
      configPath = picked.configPath;
    }
  }

  if (!configPath) {
    issues.push(t("project.noneFound", lang));
    report(issues, lang, { json: jsonOut });
    return;
  }

  let configCtx;
  try {
    configCtx = await loadConfigContext(configPath);
  } catch (err) {
    issues.push(
      t("validate.loadConfigFailed", lang, {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  if (!configCtx) {
    report(issues, lang, { json: jsonOut, configPath });
    return;
  }

  const { config, rootDir } = configCtx;

  issues.push(...validateConfig(config));

  const behaviorManifestPath = configCtx.behavior.path
    ? resolve(configCtx.behavior.path, "manifest.json")
    : null;
  const resourceManifestPath = configCtx.resource.path
    ? resolve(configCtx.resource.path, "manifest.json")
    : null;

  const behaviorExists = behaviorManifestPath ? await pathExists(behaviorManifestPath) : false;
  const resourceExists = resourceManifestPath ? await pathExists(resourceManifestPath) : false;
  if (configCtx.behavior.enabled && !behaviorExists && behaviorManifestPath) {
    issues.push(
      t("validate.missingBehaviorManifest", lang, { path: behaviorManifestPath }),
    );
  }
  if (configCtx.resource.enabled && !resourceExists && resourceManifestPath) {
    issues.push(
      t("validate.missingResourceManifest", lang, { path: resourceManifestPath }),
    );
  }

  let behaviorManifest: Manifest | undefined;
  let resourceManifest: Manifest | undefined;
  if (behaviorExists && behaviorManifestPath) {
    try {
      behaviorManifest = await readManifest(behaviorManifestPath);
    } catch (err) {
      issues.push(
        t("validate.parseBehaviorManifestFailed", lang, {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  if (resourceExists && resourceManifestPath) {
    try {
      resourceManifest = await readManifest(resourceManifestPath);
    } catch (err) {
      issues.push(
        t("validate.parseResourceManifestFailed", lang, {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const uuidSet = new Set<string>();

  if (behaviorManifest && resourceManifest) {
    issues.push(...validateManifestShape(behaviorManifest, "behavior", uuidSet, lang));
    issues.push(...validateManifestShape(resourceManifest, "resource", uuidSet, lang));

    const behaviorDependsOnResource = (behaviorManifest.dependencies ?? []).some(
      (dep) => "uuid" in dep && dep.uuid === resourceManifest!.header.uuid,
    );
    const resourceDependsOnBehavior = (resourceManifest.dependencies ?? []).some(
      (dep) => "uuid" in dep && dep.uuid === behaviorManifest!.header.uuid,
    );
    if (!behaviorDependsOnResource)
      issues.push(t("validate.behaviorMissingResourceDep", lang));
    if (!resourceDependsOnBehavior)
      issues.push(t("validate.resourceMissingBehaviorDep", lang));

    if (config.script) {
      const hasScriptModule = behaviorManifest.modules.some(
        (m) => m.type === "script",
      );
      if (!hasScriptModule) {
        issues.push(t("validate.behaviorMissingScriptModule", lang));
      }

      const manifestScriptDeps = (behaviorManifest.dependencies ?? []).filter(
        (d): d is { module_name: string; version: string } =>
          "module_name" in d && typeof d.module_name === "string",
      );
      const missingDeps = config.script.dependencies.filter((dep) => {
        // math / vanilla-data are bundled/imported, not listed as manifest deps.
        if (
          dep.module_name === "@minecraft/math" ||
          dep.module_name === "@minecraft/vanilla-data"
        ) {
          return false;
        }
        return !manifestScriptDeps.some((m) => m.module_name === dep.module_name);
      });
      if (missingDeps.length) {
        issues.push(
          t("validate.missingScriptDeps", lang, {
            deps: missingDeps.map((d) => d.module_name).join(", "),
          }),
        );
      }
    }
  }

  if (strict && behaviorManifest) {
    if (!behaviorManifest.header.min_engine_version)
      issues.push(t("validate.behaviorMissingMinEngine", lang));
    if (!behaviorManifest.header.description)
      issues.push(t("validate.behaviorMissingDescription", lang));
  }
  if (strict && resourceManifest) {
    if (!resourceManifest.header.min_engine_version)
      issues.push(t("validate.resourceMissingMinEngine", lang));
    if (!resourceManifest.header.description)
      issues.push(t("validate.resourceMissingDescription", lang));
  }

  report(issues, lang, { json: jsonOut, configPath });
}

function validateVersionTuple(
  tuple: unknown,
  context: string,
  issues: string[],
  lang: Lang,
): void {
  if (
    !Array.isArray(tuple) ||
    tuple.length !== 3 ||
    !tuple.every((n) => Number.isInteger(n) && n >= 0)
  ) {
    issues.push(t("validate.versionTuple", lang, { context }));
  }
}

function validateManifestShape(
  manifest: Manifest,
  kind: "behavior" | "resource",
  seenUuids: Set<string>,
  lang: Lang,
): string[] {
  const issues: string[] = [];
  if (manifest.format_version !== 2) {
    issues.push(t("validate.formatVersion", lang, { kind }));
  }
  if (!manifest.header?.uuid) {
    issues.push(t("validate.headerUuidMissing", lang, { kind }));
  } else if (seenUuids.has(manifest.header.uuid)) {
    issues.push(t("validate.headerUuidDuplicate", lang, { kind }));
  } else {
    seenUuids.add(manifest.header.uuid);
  }
  validateVersionTuple(
    manifest.header?.version,
    t("validate.context.header", lang, { kind }),
    issues,
    lang,
  );
  validateVersionTuple(
    manifest.header?.min_engine_version,
    t("validate.context.minEngine", lang, { kind }),
    issues,
    lang,
  );
  if (!manifest.modules || !manifest.modules.length) {
    issues.push(t("validate.modulesMissing", lang, { kind }));
  } else {
    for (const mod of manifest.modules) {
      if (!mod.uuid) {
        issues.push(t("validate.moduleUuidMissing", lang, { kind }));
      } else if (seenUuids.has(mod.uuid)) {
        issues.push(t("validate.moduleUuidDuplicate", lang, { kind }));
      } else {
        seenUuids.add(mod.uuid);
      }
      validateVersionTuple(
        mod.version,
        t("validate.context.module", lang, { kind }),
        issues,
        lang,
      );
      if (
        mod.type !== "data" &&
        mod.type !== "resources" &&
        mod.type !== "script"
      ) {
        issues.push(
          t("validate.moduleTypeInvalid", lang, {
            kind,
            type: (mod as any).type,
          }),
        );
      }
    }
  }
  return issues;
}

function report(
  issues: string[],
  lang: Lang,
  opts: { json?: boolean; configPath?: string } = {},
): void {
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: issues.length === 0,
          issues,
          configPath: opts.configPath,
        },
        null,
        2,
      ),
    );
    if (issues.length) process.exitCode = 1;
    return;
  }
  if (!issues.length) {
    console.log(t("validate.passed", resolveLang(lang)));
    return;
  }
  console.error(t("validate.issues", resolveLang(lang)));
  issues.forEach((i) => console.error(`- ${i}`));
  process.exitCode = 1;
}
