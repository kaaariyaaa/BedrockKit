import { lstat, readdir, realpath, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathExists } from "../utils/fs.js";
import { isIgnored } from "../utils/ignore.js";

export async function linkEntries(
  srcDir: string,
  destDir: string,
  rootDir: string,
  ignoreRules: RegExp[],
  excludeNames?: Set<string>,
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeNames?.has(entry.name)) continue;
    const srcPath = resolve(srcDir, entry.name);
    if (isIgnored(srcPath, rootDir, ignoreRules)) continue;
    const destPath = resolve(destDir, entry.name);
    if (await pathExists(destPath)) {
      await rm(destPath, { recursive: true, force: true });
    }
    if (entry.isDirectory()) {
      const type = process.platform === "win32" ? "junction" : "dir";
      await symlink(srcPath, destPath, type);
      continue;
    }
    if (entry.isSymbolicLink()) {
      const stat = await lstat(srcPath);
      const type = stat.isDirectory()
        ? process.platform === "win32"
          ? "junction"
          : "dir"
        : "file";
      await symlink(srcPath, destPath, type);
      continue;
    }
    await symlink(srcPath, destPath, "file");
  }
}

export async function hasTypeScriptScripts(packRoot: string): Promise<boolean> {
  const scriptsRoot = resolve(packRoot, "scripts");
  if (!(await pathExists(scriptsRoot))) return false;
  const stack = [scriptsRoot];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        return true;
      }
    }
  }
  return false;
}

export async function removeSymlinkEntries(rootDir: string): Promise<void> {
  const stack = [rootDir];
  const visited = new Set<string>();
  let visitCount = 0;
  const maxVisits = 10_000;

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    try {
      const real = await realpath(current);
      if (visited.has(real)) continue;
      visited.add(real);
    } catch {
      if (visited.has(current)) continue;
      visited.add(current);
    }

    visitCount += 1;
    if (visitCount > maxVisits) {
      throw new Error(`Maximum directory traversal limit (${maxVisits}) exceeded`);
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      const stat = await lstat(fullPath);
      if (stat.isSymbolicLink()) {
        await rm(fullPath, { recursive: true, force: true });
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
}
