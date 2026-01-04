export type CommandContext = {
  argv: string[];
  root: string;
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

export type BkitConfig = {
  project: { name: string; version: string };
  template: string;
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
  };
  script?: {
    entry: string;
    language: ScriptLanguage;
    dependencies: ScriptDependency[];
    apiVersion?: string;
  };
};
