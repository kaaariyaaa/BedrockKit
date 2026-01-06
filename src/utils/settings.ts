import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { select, isCancel, intro, outro } from "@clack/prompts";
import type { Lang } from "../types.js";
import { resolveLang, t } from "./i18n.js";

export type Settings = {
  lang?: Lang;
  initialized?: boolean;
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

export async function ensureSettings(langInput?: string | boolean): Promise<Settings> {
  const current = await loadSettings();
  if (current.initialized) return current;

  intro("BedrockKit setup");

  const choice = await select({
    message: t("onboarding.langPrompt", resolveLang(langInput)),
    options: [
      { value: "ja", label: "日本語" },
      { value: "en", label: "English" },
    ],
    initialValue: "ja",
  });
  if (isCancel(choice)) {
    outro(t("onboarding.cancelled", resolveLang(langInput)));
    throw new Error("Setup cancelled");
  }
  const lang = resolveLang(String(choice));
  const next: Settings = { ...current, lang, initialized: true };
  await saveSettings(next);
  outro(t("onboarding.saved", lang));
  return next;
}
