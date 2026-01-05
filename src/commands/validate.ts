import { resolve, dirname } from "node:path";
import type { Manifest } from "../manifest.js";
import { loadConfig, validateConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { readFile } from "node:fs/promises";
import { resolveConfigPath } from "../utils/config-discovery.js";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleValidate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const strict = !!parsed.flags.strict;
  const jsonOut = !!parsed.flags.json;
  const cwd = process.cwd();
  const issues: string[] = [];

  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined);
  if (!configPath) {
    issues.push("Config selection cancelled.");
    report(issues, { json: jsonOut, configPath: configPath ?? undefined });
    return;
  }

  let config;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    issues.push(
      err instanceof Error ? err.message : `Failed to load config: ${String(err)}`,
    );
  }

  if (!config) {
    report(issues, { json: jsonOut, configPath });
    return;
  }

  issues.push(...validateConfig(config));

  const configDir = dirname(configPath);
  const rootDir = config.paths?.root ? resolve(configDir, config.paths.root) : configDir;
  const behaviorManifestPath = resolve(rootDir, config.packs.behavior, "manifest.json");
  const resourceManifestPath = resolve(rootDir, config.packs.resource, "manifest.json");

  const behaviorExists = await pathExists(behaviorManifestPath);
  const resourceExists = await pathExists(resourceManifestPath);
  if (!behaviorExists) issues.push(`Missing behavior manifest at ${behaviorManifestPath}`);
  if (!resourceExists) issues.push(`Missing resource manifest at ${resourceManifestPath}`);

  let behaviorManifest: Manifest | undefined;
  let resourceManifest: Manifest | undefined;
  if (behaviorExists) {
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
  if (resourceExists) {
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

  if (behaviorManifest && resourceManifest) {
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
