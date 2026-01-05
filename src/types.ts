export type Lang = "ja" | "en";

export type CommandContext = {
  argv: string[];
  root: string;
  lang?: Lang;
};

export type Command = {
  name: string;
  aliases?: string[];
  description: string;
  run: (ctx: CommandContext) => void | Promise<void>;
};

export type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

export type VersionTuple = [number, number, number];

export type ScriptLanguage = "javascript" | "typescript";

export type ScriptDependency = { module_name: string; version: string };
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

export type ScriptApiSelection = {
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

export type BkitConfig = {
  project: { name: string; version: string };
  template: string;
  packSelection?: {
    behavior?: boolean;
    resource?: boolean;
  };
  paths?: {
    root?: string;
  };
  packs: {
    behavior: string;
    resource: string;
  };
  build: {
    outDir: string;
    target: string;
  };
  sync: {
    defaultTarget: string;
    targets?: Record<
      string,
      {
        /**
         * If provided, uses @minecraft/core-build-tasks copyTask to deploy to the
         * game's development folders for the given product (e.g. BedrockUWP).
         * Falls back to manual copy when not set.
         */
        product?: "BedrockUWP" | "PreviewUWP" | "BedrockGDK" | "PreviewGDK";
        /**
         * Destination project folder name in development_packs.
         * Defaults to config.project.name when omitted.
         */
        projectName?: string;
        behavior?: string;
        resource?: string;
      }
    >;
  };
  script?: {
    entry: string;
    language: ScriptLanguage;
    dependencies: ScriptDependency[];
    apiVersion?: string;
  };
};
