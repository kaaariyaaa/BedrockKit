import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathExists } from "./fs.js";

type IgnoreRule = RegExp;

function patternToRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  // Basic glob-like to regex: * => .* (greedy), leading slash anchors to start.
  const escaped = trimmed
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*") // ** for deep
    .replace(/\*/g, "[^/]*");
  const anchored = trimmed.startsWith("/") ? `^${escaped.slice(1)}$` : `^.*${escaped}$`;
  return new RegExp(anchored);
}

export async function loadIgnoreRules(rootDir: string): Promise<IgnoreRule[]> {
  const file = resolve(rootDir, ".bkitignore");
  if (!(await pathExists(file))) return [];
  const raw = await readFile(file, { encoding: "utf8" });
  const lines = raw.split(/\r?\n/);
  const rules: IgnoreRule[] = [];
  for (const line of lines) {
    const rx = patternToRegex(line);
    if (rx) rules.push(rx);
  }
  return rules;
}

export function isIgnored(pathAbs: string, rootDir: string, rules: IgnoreRule[]): boolean {
  if (!rules.length) return false;
  const rel = relative(rootDir, pathAbs).replace(/\\/g, "/");
  return rules.some((rule) => rule.test(rel));
}
