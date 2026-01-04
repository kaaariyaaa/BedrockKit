import { randomUUID } from "node:crypto";
import type { VersionTuple } from "./types.js";

export type ManifestModule =
  | {
      type: "data" | "resources";
      uuid: string;
      version: VersionTuple;
    }
  | {
      type: "script";
      language: "javascript" | "typescript";
      entry: string;
      uuid: string;
      version: VersionTuple;
    };

export type ManifestUuidDependency = { uuid: string; version: VersionTuple };
export type ManifestScriptDependency = { module_name: string; version: string };
export type ManifestDependency = ManifestUuidDependency | ManifestScriptDependency;

export type Manifest = {
  format_version: number;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: VersionTuple;
    min_engine_version: VersionTuple;
  };
  modules: ManifestModule[];
  dependencies?: ManifestDependency[];
};

export type GenerateManifestOptions = {
  type: "behavior" | "resource";
  name: string;
  description?: string;
  version?: VersionTuple;
  minEngine?: VersionTuple;
  includeScriptModule?: boolean;
  scriptEntry?: string;
  scriptLanguage?: "javascript" | "typescript";
  scriptDependencies?: ManifestScriptDependency[];
  scriptApiVersion?: string;
  scriptApiVersions?: ScriptApiVersionMap;
  scriptApiSelection?: ScriptApiVersionSelection;
};

export type ScriptApiVersionMap = {
  server?: string;
  serverUi?: string;
  common?: string;
  math?: string;
};

export type ScriptApiVersionSelection = {
  server?: boolean;
  serverUi?: boolean;
  common?: boolean;
  math?: boolean;
};

export const DEFAULT_SCRIPT_API_VERSION = "1.11.0";

export function buildScriptDependencies(
  version: string = DEFAULT_SCRIPT_API_VERSION,
): ManifestScriptDependency[] {
  return [
    { module_name: "@minecraft/server", version },
    { module_name: "@minecraft/server-ui", version },
    { module_name: "@minecraft/common", version },
    { module_name: "@minecraft/math", version },
  ];
}

export function buildScriptDependenciesFromMap(
  versions: ScriptApiVersionMap,
  fallback: string = DEFAULT_SCRIPT_API_VERSION,
  selection: ScriptApiVersionSelection = {
    server: true,
    serverUi: true,
    common: false,
    math: false,
  },
): ManifestScriptDependency[] {
  const deps: ManifestScriptDependency[] = [];
  if (selection.server !== false) {
    deps.push({ module_name: "@minecraft/server", version: versions.server ?? fallback });
  }
  if (selection.serverUi !== false) {
    deps.push({ module_name: "@minecraft/server-ui", version: versions.serverUi ?? fallback });
  }
  if (selection.common !== false) {
    deps.push({ module_name: "@minecraft/common", version: versions.common ?? fallback });
  }
  if (selection.math !== false) {
    deps.push({ module_name: "@minecraft/math", version: versions.math ?? fallback });
  }
  return deps;
}

export const defaultScriptDependencies = buildScriptDependencies();

export function generateManifest(opts: GenerateManifestOptions): Manifest {
  const version = opts.version ?? [1, 0, 0];
  const minEngine = opts.minEngine ?? [1, 20, 0];

  const packUuid = randomUUID();
  const moduleUuid = randomUUID();
  const modules: ManifestModule[] = [
    {
      type: opts.type === "behavior" ? "data" : "resources",
      uuid: moduleUuid,
      version,
    },
  ];

  const dependencies: ManifestDependency[] = [];
  if (opts.type === "behavior" && opts.includeScriptModule !== false) {
    modules.push({
      type: "script",
      language: opts.scriptLanguage ?? "javascript",
      entry: opts.scriptEntry ?? "scripts/main.js",
      uuid: randomUUID(),
      version,
    });
    const scriptDeps =
      opts.scriptDependencies ??
      (opts.scriptApiVersions
        ? buildScriptDependenciesFromMap(
            opts.scriptApiVersions,
            opts.scriptApiVersion ?? DEFAULT_SCRIPT_API_VERSION,
            opts.scriptApiSelection,
          )
        : buildScriptDependencies(opts.scriptApiVersion ?? DEFAULT_SCRIPT_API_VERSION));
    dependencies.push(...scriptDeps);
  }

  return {
    format_version: 2,
    header: {
      name: `${opts.name} (${opts.type})`,
      description: opts.description ?? `${opts.name} ${opts.type} pack`,
      uuid: packUuid,
      version,
      min_engine_version: minEngine,
    },
    modules,
    dependencies: dependencies.length ? dependencies : undefined,
  };
}
