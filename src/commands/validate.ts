import { resolve } from "node:path";
import type { Manifest } from "../manifest.js";
import { loadConfig, validateConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists } from "../utils/fs.js";
import { readFile } from "node:fs/promises";

async function readManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, { encoding: "utf8" });
  return JSON.parse(raw) as Manifest;
}

export async function handleValidate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const strict = !!parsed.flags.strict;
  const cwd = process.cwd();
  const issues: string[] = [];

  let configPath = resolve(cwd, "bkit.config.json");
  if (typeof parsed.flags.config === "string") {
    configPath = resolve(cwd, parsed.flags.config);
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
    report(issues);
    return;
  }

  issues.push(...validateConfig(config));

  const behaviorManifestPath = resolve(cwd, config.packs.behavior, "manifest.json");
  const resourceManifestPath = resolve(cwd, config.packs.resource, "manifest.json");

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
      const missingDeps = config.script.dependencies.filter(
        (dep) => !manifestScriptDeps.some((m) => m.module_name === dep.module_name),
      );
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

  report(issues);
}

function report(issues: string[]): void {
  if (!issues.length) {
    console.log("Validation passed.");
    return;
  }
  console.error("Validation issues:");
  issues.forEach((i) => console.error(`- ${i}`));
  process.exitCode = 1;
}
