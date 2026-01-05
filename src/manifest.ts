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
  metadata?: {
    product_type?: string;
  };
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
  serverNet?: string;
  serverGametest?: string;
  serverAdmin?: string;
  debugUtilities?: string;
  vanillaData?: string;
};

export type ScriptApiVersionSelection = {
  server?: boolean;
  serverUi?: boolean;
  common?: boolean;
  math?: boolean;
  serverNet?: boolean;
  serverGametest?: boolean;
  serverAdmin?: boolean;
  debugUtilities?: boolean;
  vanillaData?: boolean;
};

export const DEFAULT_SCRIPT_API_VERSION = "1.11.0";

export function buildScriptDependencies(
  version: string = DEFAULT_SCRIPT_API_VERSION,
  selection: ScriptApiVersionSelection = {
    server: true,
    serverUi: true,
    common: false,
    math: false,
    serverNet: false,
    serverGametest: false,
    serverAdmin: false,
    debugUtilities: false,
    vanillaData: false,
  },
): ManifestScriptDependency[] {
  return [
    ...(selection.server !== false ? [{ module_name: "@minecraft/server", version }] : []),
    ...(selection.serverUi !== false ? [{ module_name: "@minecraft/server-ui", version }] : []),
    ...(selection.common !== false ? [{ module_name: "@minecraft/common", version }] : []),
    ...(selection.math !== false ? [{ module_name: "@minecraft/math", version }] : []),
    ...(selection.serverNet !== false ? [{ module_name: "@minecraft/server-net", version }] : []),
    ...(selection.serverGametest !== false
      ? [{ module_name: "@minecraft/server-gametest", version }]
      : []),
    ...(selection.serverAdmin !== false ? [{ module_name: "@minecraft/server-admin", version }] : []),
    ...(selection.debugUtilities !== false
      ? [{ module_name: "@minecraft/debug-utilities", version }]
      : []),
    ...(selection.vanillaData !== false
      ? [{ module_name: "@minecraft/vanilla-data", version }]
      : []),
  ].filter(Boolean) as ManifestScriptDependency[];
}

export function buildScriptDependenciesFromMap(
  versions: ScriptApiVersionMap,
  fallback: string = DEFAULT_SCRIPT_API_VERSION,
  selection: ScriptApiVersionSelection = {
    server: true,
    serverUi: true,
    common: false,
    math: false,
    serverNet: false,
    serverGametest: false,
    serverAdmin: false,
    debugUtilities: false,
    vanillaData: false,
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
  if (selection.serverNet !== false) {
    deps.push({ module_name: "@minecraft/server-net", version: versions.serverNet ?? fallback });
  }
  if (selection.serverGametest !== false) {
    deps.push({
      module_name: "@minecraft/server-gametest",
      version: versions.serverGametest ?? fallback,
    });
  }
  if (selection.serverAdmin !== false) {
    deps.push({
      module_name: "@minecraft/server-admin",
      version: versions.serverAdmin ?? fallback,
    });
  }
  if (selection.debugUtilities !== false) {
    deps.push({
      module_name: "@minecraft/debug-utilities",
      version: versions.debugUtilities ?? fallback,
    });
  }
  if (selection.vanillaData !== false) {
    deps.push({
      module_name: "@minecraft/vanilla-data",
      version: versions.vanillaData ?? fallback,
    });
  }
  return deps;
}

export const defaultScriptDependencies = buildScriptDependencies();

export function generateManifest(opts: GenerateManifestOptions): Manifest {
  const version = opts.version ?? [1, 0, 0];
  const minEngine = opts.minEngine ?? [1, 21, 2];

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
        : buildScriptDependencies(
            opts.scriptApiVersion ?? DEFAULT_SCRIPT_API_VERSION,
            opts.scriptApiSelection,
          ));
    // Exclude math/vanilla-data from manifest dependencies; they are bundled/imported directly.
    dependencies.push(
      ...scriptDeps.filter(
        (dep) =>
          !(
            "module_name" in dep &&
            (dep.module_name === "@minecraft/math" || dep.module_name === "@minecraft/vanilla-data")
          ),
      ),
    );
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
    metadata: {
      product_type: "addon",
    },
  };
}
