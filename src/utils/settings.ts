import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { select, text, isCancel, intro, outro } from "@clack/prompts";
import type { Lang } from "../types.js";
import { resolveLang, t } from "./i18n.js";

export type Settings = {
  lang?: {
    value?: Lang;
    setupDone?: boolean;
    onboarding?: boolean;
  };
  projectRoot?: {
    path?: string;
    setupDone?: boolean;
    onboarding?: boolean;
  };
  onboardingOrder?: SettingKey[];
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

export type SettingKey = "lang" | "projectRoot";

export function resolveOnboardingOrder(settings?: Settings): SettingKey[] {
  const order = settings?.onboardingOrder?.filter(
    (key): key is SettingKey => key === "lang" || key === "projectRoot",
  );
  const defaultOrder: SettingKey[] = ["lang", "projectRoot"];
  const base = order && order.length ? [...order] : defaultOrder;
  const withoutLang = base.filter((k) => k !== "lang");
  return ["lang", ...withoutLang];
}

export async function promptLangSelection(langInput?: string | boolean): Promise<Lang | null> {
  const choice = await select({
    message: t("onboarding.langPrompt", resolveLang(langInput)),
    options: [
      { value: "ja", label: "日本語" },
      { value: "en", label: "English" },
    ],
    initialValue: "ja",
  });
  if (isCancel(choice)) return null;
  return resolveLang(String(choice));
}

export async function promptProjectRoot(lang: Lang, current: string): Promise<string | null> {
  const rootInput = await text({
    message: t("onboarding.projectRootPrompt", lang),
    initialValue: current,
    validate: (v) => (!v.trim() ? t("common.required", lang) : undefined),
  });
  if (isCancel(rootInput)) return null;
  return String(rootInput).trim();
}

export async function ensureSettings(langInput?: string | boolean): Promise<Settings> {
  const current = await loadSettings();
  const legacyLang =
    typeof (current as unknown as { lang?: unknown }).lang === "string"
      ? (current as unknown as { lang?: Lang }).lang
      : undefined;
  const legacyRoot =
    typeof (current as unknown as { projectRoot?: unknown }).projectRoot === "string"
      ? (current as unknown as { projectRoot?: string }).projectRoot
      : undefined;

  const currentLang = current.lang?.value ?? legacyLang;
  const currentRoot = current.projectRoot?.path ?? legacyRoot;
  const order = resolveOnboardingOrder(current);
  const needs = {
    lang:
      (current.lang?.onboarding ?? true) &&
      (!currentLang || !current.lang?.setupDone),
    projectRoot:
      (current.projectRoot?.onboarding ?? true) &&
      (!currentRoot || !current.projectRoot?.setupDone),
  };
  if (!needs.lang && !needs.projectRoot) return current;

  intro("BedrockKit setup");

  let lang = currentLang ?? resolveLang(langInput);
  let projectRoot = currentRoot ?? resolve(process.cwd(), "project");
  for (const key of order) {
    if (key === "lang" && needs.lang) {
      const picked = await promptLangSelection(langInput);
      if (!picked) {
        outro(t("onboarding.cancelled", resolveLang(langInput)));
        throw new Error("Setup cancelled");
      }
      lang = picked;
    }
    if (key === "projectRoot" && needs.projectRoot) {
      const picked = await promptProjectRoot(lang, projectRoot);
      if (!picked) {
        outro(t("onboarding.cancelled", lang));
        throw new Error("Setup cancelled");
      }
      projectRoot = picked;
    }
  }
  const next: Settings = {
    ...current,
    lang: { value: lang, setupDone: true, onboarding: current.lang?.onboarding ?? false },
    projectRoot: {
      path: projectRoot,
      setupDone: true,
      onboarding: current.projectRoot?.onboarding ?? true,
    },
    onboardingOrder: order,
  };
  await saveSettings(next);
  outro(t("onboarding.saved", lang));
  return next;
}

export function resolveProjectRoot(settings?: Settings): string {
  const legacyRoot =
    typeof (settings as unknown as { projectRoot?: unknown })?.projectRoot === "string"
      ? (settings as unknown as { projectRoot?: string }).projectRoot
      : undefined;
  const raw = settings?.projectRoot?.path ?? legacyRoot ?? "project";
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}
