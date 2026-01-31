import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, isAbsolute, relative, normalize } from "node:path";
import { homedir } from "node:os";
import { select, text, isCancel, intro, outro } from "../tui/prompts.js";
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
  update?: {
    skipVersion?: string;
  };
};

const userHome = process.env.USERPROFILE ?? homedir();

// Sanitize path to prevent path traversal attacks
function sanitizePath(input: string, baseDir: string): string {
  const normalized = normalize(input);
  const resolved = isAbsolute(normalized)
    ? normalized
    : resolve(baseDir, normalized);

  // Prevent path traversal outside of base directory
  const rel = relative(baseDir, resolved);
  if (rel.startsWith("..") || rel.includes("../") || rel.includes("..\\")) {
    throw new Error(`Invalid path: path traversal detected in "${input}"`);
  }

  return resolved;
}

const settingsDir = process.env.BKIT_SETTINGS_DIR
  ? sanitizePath(process.env.BKIT_SETTINGS_DIR, userHome)
  : resolve(userHome, ".bkit");
const settingsPath = resolve(settingsDir, "settings.json");

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(settingsPath, "utf8");
    try {
      return JSON.parse(raw) as Settings;
    } catch (parseError) {
      console.error(
        `Failed to parse settings file at ${settingsPath}: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
      return {};
    }
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

  intro(t("settings.setupTitle", resolveLang(langInput)));

  let lang = currentLang ?? resolveLang(langInput);
  let projectRoot = currentRoot ?? resolve(userHome, "project");
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

  // Validate and sanitize the path to prevent path traversal
  try {
    return isAbsolute(raw) ? raw : sanitizePath(raw, userHome);
  } catch (error) {
    console.warn(`Invalid projectRoot path "${raw}", using default: ${error}`);
    return resolve(userHome, "project");
  }
}
