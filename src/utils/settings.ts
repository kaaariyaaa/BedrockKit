import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Lang } from "../types.js";

export type Settings = {
  lang?: Lang;
};

const settingsDir = resolve(process.cwd(), ".bkit");
const settingsPath = resolve(settingsDir, "settings.json");

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(settingsPath, "utf8");
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

export async function saveSettings(next: Settings): Promise<void> {
  await mkdir(settingsDir, { recursive: true });
  await writeFile(settingsPath, JSON.stringify(next, null, 2), "utf8");
}

export function getSettingsPath(): string {
  return settingsPath;
}
