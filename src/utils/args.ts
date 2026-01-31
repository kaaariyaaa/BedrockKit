import type { ParsedArgs } from "../types.js";

function parseFlagValue(value: string): string | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const [key, maybeValue] = arg.slice(2).split("=");
      if (maybeValue !== undefined) {
        flags[key] = parseFlagValue(maybeValue);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = parseFlagValue(next);
          i += 1;
        } else {
          flags[key] = true;
        }
      }
      continue;
    }
    if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = parseFlagValue(next);
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags };
}
