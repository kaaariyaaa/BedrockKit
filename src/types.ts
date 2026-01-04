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
