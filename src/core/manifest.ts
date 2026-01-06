import { randomUUID } from "node:crypto";
import type { VersionTuple } from "../types.js";

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

function normalizeManifestVersion(version: string): string {
  const m = version.match(/^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z]+))?/);
  if (!m) return version;
  const base = m[1]!;
  const tag = m[2];
  return tag ? `${base}-${tag}` : base;
}

function defaultSelection(): ScriptApiVersionSelection {
  return {
    server: true,
    serverUi: true,
    common: false,
    math: false,
    serverNet: false,
    serverGametest: false,
    serverAdmin: false,
    debugUtilities: false,
    vanillaData: false,
  };
}

export function buildScriptDependencies(
  version: string = DEFAULT_SCRIPT_API_VERSION,
  selection: ScriptApiVersionSelection = defaultSelection(),
): ManifestScriptDependency[] {
  const v = normalizeManifestVersion(version);
  return [
    ...(selection.server !== false ? [{ module_name: "@minecraft/server", version: v }] : []),
    ...(selection.serverUi !== false ? [{ module_name: "@minecraft/server-ui", version: v }] : []),
    ...(selection.common !== false ? [{ module_name: "@minecraft/common", version: v }] : []),
    ...(selection.math !== false ? [{ module_name: "@minecraft/math", version: v }] : []),
    ...(selection.serverNet !== false ? [{ module_name: "@minecraft/server-net", version: v }] : []),
    ...(selection.serverGametest !== false
      ? [{ module_name: "@minecraft/server-gametest", version: v }]
      : []),
    ...(selection.serverAdmin !== false ? [{ module_name: "@minecraft/server-admin", version: v }] : []),
    ...(selection.debugUtilities !== false
      ? [{ module_name: "@minecraft/debug-utilities", version: v }]
      : []),
    ...(selection.vanillaData !== false
      ? [{ module_name: "@minecraft/vanilla-data", version: v }]
      : []),
  ].filter(Boolean) as ManifestScriptDependency[];
}

export function buildScriptDependenciesFromMap(
  versions: ScriptApiVersionMap,
  fallback: string = DEFAULT_SCRIPT_API_VERSION,
  selection: ScriptApiVersionSelection = defaultSelection(),
): ManifestScriptDependency[] {
  const deps: ManifestScriptDependency[] = [];
  if (selection.server !== false) {
    deps.push({
      module_name: "@minecraft/server",
      version: normalizeManifestVersion(versions.server ?? fallback),
    });
  }
  if (selection.serverUi !== false) {
    deps.push({
      module_name: "@minecraft/server-ui",
      version: normalizeManifestVersion(versions.serverUi ?? fallback),
    });
  }
  if (selection.common !== false) {
    deps.push({
      module_name: "@minecraft/common",
      version: normalizeManifestVersion(versions.common ?? fallback),
    });
  }
  if (selection.math !== false) {
    deps.push({
      module_name: "@minecraft/math",
      version: normalizeManifestVersion(versions.math ?? fallback),
    });
  }
  if (selection.serverNet !== false) {
    deps.push({
      module_name: "@minecraft/server-net",
      version: normalizeManifestVersion(versions.serverNet ?? fallback),
    });
  }
  if (selection.serverGametest !== false) {
    deps.push({
      module_name: "@minecraft/server-gametest",
      version: normalizeManifestVersion(versions.serverGametest ?? fallback),
    });
  }
  if (selection.serverAdmin !== false) {
    deps.push({
      module_name: "@minecraft/server-admin",
      version: normalizeManifestVersion(versions.serverAdmin ?? fallback),
    });
  }
  if (selection.debugUtilities !== false) {
    deps.push({
      module_name: "@minecraft/debug-utilities",
      version: normalizeManifestVersion(versions.debugUtilities ?? fallback),
    });
  }
  if (selection.vanillaData !== false) {
    deps.push({
      module_name: "@minecraft/vanilla-data",
      version: normalizeManifestVersion(versions.vanillaData ?? fallback),
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
