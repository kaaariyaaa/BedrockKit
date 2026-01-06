import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { Manifest } from "../core/manifest.js";
import {
  loadConfigContext,
  resolveConfigPath,
  validateConfig,
} from "../core/config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { resolveLang } from "../utils/i18n.js";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleValidate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const strict = !!parsed.flags.strict;
  const jsonOut = !!parsed.flags.json;
  const cwd = process.cwd();
  const issues: string[] = [];

  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    issues.push("Config selection cancelled.");
    report(issues, { json: jsonOut, configPath: configPath ?? undefined });
    return;
  }

  let configCtx;
  try {
    configCtx = await loadConfigContext(configPath);
  } catch (err) {
    issues.push(
      err instanceof Error ? err.message : `Failed to load config: ${String(err)}`,
    );
  }

  if (!configCtx) {
    report(issues, { json: jsonOut, configPath });
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
    issues.push(`Missing behavior manifest at ${behaviorManifestPath}`);
  }
  if (configCtx.resource.enabled && !resourceExists && resourceManifestPath) {
    issues.push(`Missing resource manifest at ${resourceManifestPath}`);
  }

  let behaviorManifest: Manifest | undefined;
  let resourceManifest: Manifest | undefined;
  if (behaviorExists && behaviorManifestPath) {
    try {
      behaviorManifest = await readManifest(behaviorManifestPath);
    } catch (err) {
      issues.push(
        `Failed to parse behavior manifest: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  if (resourceExists && resourceManifestPath) {
    try {
      resourceManifest = await readManifest(resourceManifestPath);
    } catch (err) {
      issues.push(
        `Failed to parse resource manifest: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const uuidSet = new Set<string>();

  if (behaviorManifest && resourceManifest) {
    issues.push(...validateManifestShape(behaviorManifest, "behavior", uuidSet));
    issues.push(...validateManifestShape(resourceManifest, "resource", uuidSet));

    const behaviorDependsOnResource = (behaviorManifest.dependencies ?? []).some(
      (dep) => "uuid" in dep && dep.uuid === resourceManifest!.header.uuid,
    );
    const resourceDependsOnBehavior = (resourceManifest.dependencies ?? []).some(
      (dep) => "uuid" in dep && dep.uuid === behaviorManifest!.header.uuid,
    );
    if (!behaviorDependsOnResource)
      issues.push("Behavior pack manifest missing dependency on resource pack");
    if (!resourceDependsOnBehavior)
      issues.push("Resource pack manifest missing dependency on behavior pack");

    if (config.script) {
      const hasScriptModule = behaviorManifest.modules.some(
        (m) => m.type === "script",
      );
      if (!hasScriptModule) {
        issues.push("Behavior pack missing script module while config.script is defined");
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
          `Behavior manifest missing script dependencies: ${missingDeps
            .map((d) => d.module_name)
            .join(", ")}`,
        );
      }
    }
  }

  if (strict && behaviorManifest) {
    if (!behaviorManifest.header.min_engine_version)
      issues.push("Behavior manifest missing min_engine_version");
    if (!behaviorManifest.header.description)
      issues.push("Behavior manifest missing description");
  }
  if (strict && resourceManifest) {
    if (!resourceManifest.header.min_engine_version)
      issues.push("Resource manifest missing min_engine_version");
    if (!resourceManifest.header.description)
      issues.push("Resource manifest missing description");
  }

  report(issues, { json: jsonOut, configPath });
}

function validateVersionTuple(tuple: unknown, context: string, issues: string[]): void {
  if (
    !Array.isArray(tuple) ||
    tuple.length !== 3 ||
    !tuple.every((n) => Number.isInteger(n) && n >= 0)
  ) {
    issues.push(`${context} version must be a tuple of three non-negative integers`);
  }
}

function validateManifestShape(
  manifest: Manifest,
  kind: "behavior" | "resource",
  seenUuids: Set<string>,
): string[] {
  const issues: string[] = [];
  if (manifest.format_version !== 2) {
    issues.push(`${kind} manifest format_version should be 2`);
  }
  if (!manifest.header?.uuid) {
    issues.push(`${kind} manifest header.uuid is missing`);
  } else if (seenUuids.has(manifest.header.uuid)) {
    issues.push(`${kind} manifest header.uuid duplicates another UUID`);
  } else {
    seenUuids.add(manifest.header.uuid);
  }
  validateVersionTuple(manifest.header?.version, `${kind} manifest header`, issues);
  validateVersionTuple(
    manifest.header?.min_engine_version,
    `${kind} manifest header.min_engine_version`,
    issues,
  );
  if (!manifest.modules || !manifest.modules.length) {
    issues.push(`${kind} manifest modules are missing`);
  } else {
    for (const mod of manifest.modules) {
      if (!mod.uuid) {
        issues.push(`${kind} manifest module missing uuid`);
      } else if (seenUuids.has(mod.uuid)) {
        issues.push(`${kind} manifest module uuid duplicates another UUID`);
      } else {
        seenUuids.add(mod.uuid);
      }
      validateVersionTuple(mod.version, `${kind} manifest module`, issues);
      if (
        mod.type !== "data" &&
        mod.type !== "resources" &&
        mod.type !== "script"
      ) {
        issues.push(`${kind} manifest module type '${(mod as any).type}' is invalid`);
      }
    }
  }
  return issues;
}

function report(
  issues: string[],
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
    console.log("Validation passed.");
    return;
  }
  console.error("Validation issues:");
  issues.forEach((i) => console.error(`- ${i}`));
  process.exitCode = 1;
}
