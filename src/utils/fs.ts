import { existsSync, readdirSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  const dir = resolve(path, "..");
  await ensureDir(dir);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
  });
}

export function isDirEmpty(path: string): boolean {
  if (!existsSync(path)) return true;
  const entries = readdirSync(path);
  return entries.length === 0;
}
