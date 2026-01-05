import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { Manifest, ManifestDependency } from "../manifest.js";
import { loadConfig } from "../config.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { pathExists, writeJson } from "../utils/fs.js";
import {
  BumpLevel,
  bumpTuple,
  bumpVersionString,
  stringToVersionTuple,
} from "../utils/version.js";
import { resolveConfigPath } from "../utils/config-discovery.js";
import { resolveLang } from "../utils/i18n.js";

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
  const level = (parsed.positional[0] as BumpLevel | undefined) ?? "patch";

  const configPath = await resolveConfigPath(parsed.flags.config as string | undefined, lang);
  if (!configPath) {
    console.error("Config selection cancelled.");
    process.exitCode = 1;
    return;
  }

  if (!(await pathExists(configPath))) {
    console.error(`Config not found: ${configPath}`);
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(configPath);
  const configDir = dirname(configPath);
  const rootDir = config.paths?.root
    ? resolve(configDir, config.paths.root)
    : configDir;

  const nextVersionString = bumpVersionString(config.project.version, level);
  const nextVersionTuple = stringToVersionTuple(nextVersionString);

  config.project.version = nextVersionString;

  const behaviorManifestPath = resolve(rootDir, config.packs.behavior, "manifest.json");
  const resourceManifestPath = resolve(rootDir, config.packs.resource, "manifest.json");

  if (!(await pathExists(behaviorManifestPath))) {
    console.error(`Behavior manifest not found: ${behaviorManifestPath}`);
    process.exitCode = 1;
    return;
  }
  if (!(await pathExists(resourceManifestPath))) {
    console.error(`Resource manifest not found: ${resourceManifestPath}`);
    process.exitCode = 1;
    return;
  }

  const behaviorManifest = await readManifest(behaviorManifestPath);
  const resourceManifest = await readManifest(resourceManifestPath);

  updateManifestVersion(behaviorManifest, nextVersionTuple);
  updateManifestVersion(resourceManifest, nextVersionTuple);

  await writeJson(configPath, config);
  await writeJson(behaviorManifestPath, behaviorManifest);
  await writeJson(resourceManifestPath, resourceManifest);

  console.log(
    `Bumped version (${level}) to ${nextVersionString} in config and manifests.`,
  );
}
