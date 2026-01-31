import { readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathExists } from "./fs.js";

type IgnoreRule = RegExp;

// Security limits to prevent ReDoS attacks
const MAX_PATTERN_LENGTH = 1000;
const MAX_RULES_COUNT = 1000;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

function patternToRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // Limit pattern length to prevent ReDoS
  if (trimmed.length > MAX_PATTERN_LENGTH) {
    console.warn(`Pattern too long (${trimmed.length} chars), skipping: ${trimmed.slice(0, 50)}...`);
    return null;
  }

  // Detect dangerous patterns (too many consecutive wildcards)
  if (/\*{5,}/.test(trimmed)) {
    console.warn(`Potentially dangerous pattern (too many wildcards), skipping: ${trimmed.slice(0, 50)}...`);
    return null;
  }

  // Basic glob-like to regex: * => .* (greedy), leading slash anchors to start.
  const escaped = trimmed
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*") // ** for deep
    .replace(/\*/g, "[^/]*");
  const anchored = trimmed.startsWith("/") ? `^${escaped.slice(1)}$` : `^.*${escaped}$`;

  try {
    return new RegExp(anchored);
  } catch (e) {
    console.warn(`Invalid regex pattern, skipping: ${trimmed.slice(0, 50)}...`);
    return null;
  }
}

export async function loadIgnoreRules(rootDir: string): Promise<IgnoreRule[]> {
  const file = resolve(rootDir, ".bkitignore");
  if (!(await pathExists(file))) return [];

  // Check file size to prevent memory issues
  try {
    const stats = await stat(file);
    if (stats.size > MAX_FILE_SIZE) {
      console.warn(`.bkitignore file too large (${stats.size} bytes), skipping`);
      return [];
    }
  } catch {
    return [];
  }

  const raw = await readFile(file, { encoding: "utf8" });
  const lines = raw.split(/\r?\n/);

  // Limit number of rules
  if (lines.length > MAX_RULES_COUNT) {
    console.warn(`Too many ignore rules (${lines.length}), truncating to ${MAX_RULES_COUNT}`);
    lines.length = MAX_RULES_COUNT;
  }

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
