import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { select, text, isCancel, intro, outro } from "@clack/prompts";
import type { Lang } from "../types.js";
import { resolveLang, t } from "./i18n.js";

export type Settings = {
  lang?: Lang;
  initialized?: boolean;
  projectRoot?: string;
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

  const rootInput = await text({
    message: t("onboarding.projectRootPrompt", resolveLang(langInput)),
    initialValue: resolve(process.cwd(), "project"),
    validate: (v) => (!v.trim() ? t("common.required", resolveLang(langInput)) : undefined),
  });
  if (isCancel(rootInput)) {
    outro(t("onboarding.cancelled", resolveLang(langInput)));
    throw new Error("Setup cancelled");
  }
  const projectRoot = String(rootInput).trim();

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
  const next: Settings = { ...current, lang, initialized: true, projectRoot };
  await saveSettings(next);
  outro(t("onboarding.saved", lang));
  return next;
}

export function resolveProjectRoot(settings?: Settings): string {
  const raw = settings?.projectRoot ?? "project";
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}
