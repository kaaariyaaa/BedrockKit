import type { ParsedArgs } from "../types.js";

// Dangerous keys that could lead to prototype pollution
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];

function parseFlagValue(value: string): string | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function isValidKey(key: string): boolean {
  // Reject dangerous keys that could cause prototype pollution
  if (FORBIDDEN_KEYS.includes(key)) {
    console.warn(`Forbidden flag name ignored: ${key}`);
    return false;
  }
  // Only allow alphanumeric characters, dashes, and underscores
  if (!/^[\w-]+$/.test(key)) {
    console.warn(`Invalid flag name ignored: ${key}`);
    return false;
  }
  return true;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  // Use Object.create(null) to avoid prototype pollution
  const flags: Record<string, string | boolean> = Object.create(null);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const [key, maybeValue] = arg.slice(2).split("=");
      // Validate key to prevent prototype pollution
      if (!isValidKey(key)) {
        continue;
      }
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
      // Validate single-dash keys too
      if (!isValidKey(key)) {
        continue;
      }
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
