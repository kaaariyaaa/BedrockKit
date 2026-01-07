import { select, isCancel } from "@clack/prompts";
import { resolve } from "node:path";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang, t } from "../utils/i18n.js";
import {
  loadSettings,
  saveSettings,
  getSettingsPath,
  promptLangSelection,
  promptProjectRoot,
} from "../utils/settings.js";

export async function handleSetting(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const settings = await loadSettings();
  const currentLang = settings.lang?.value ?? ctx.lang ?? resolveLang(parsed.flags.lang);
  // Flags: --lang <ja|en>
  const langFlag = parsed.flags.lang as string | undefined;
  const projectRootFlag = parsed.flags["project-root"] as string | undefined;

  if (langFlag) {
    const next = langFlag === "en" ? "en" : "ja";
    await saveSettings({
      ...settings,
      lang: { value: next, setupDone: true, onboarding: settings.lang?.onboarding ?? true },
    });
    console.log(t("setting.languageSaved", next));
    console.log(`${t("setting.current", next)}: lang=${next} (${t("setting.langDesc", next)})`);
    return;
  }

  let updated = false;
  const nextSettings = { ...settings };
  if (projectRootFlag) {
    nextSettings.projectRoot = {
      path: projectRootFlag,
      setupDone: true,
      onboarding: settings.projectRoot?.onboarding ?? true,
    };
    updated = true;
  }
  if (updated) {
    await saveSettings(nextSettings);
    console.log(t("setting.current", currentLang));
    console.log(
      t("setting.projectRootLine", currentLang, {
        path: nextSettings.projectRoot?.path ?? t("setting.unset", currentLang),
      }),
    );
    return;
  }

  const choice = await select({
    message: t("setting.selectItem", currentLang),
    options: [
      { value: "lang", label: t("setting.language", currentLang), hint: t("setting.langDesc", currentLang) },
      {
        value: "projectRoot",
        label: t("setting.projectRoot", currentLang),
        hint: t("setting.projectRootHint", currentLang),
      },
    ],
  });
  if (isCancel(choice)) {
    console.log(t("common.cancelled", currentLang));
    return;
  }

  if (choice === "lang") {
    const picked = await promptLangSelection(currentLang);
    if (!picked) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    const next = picked;
    await saveSettings({
      ...settings,
      lang: { value: next, setupDone: true, onboarding: settings.lang?.onboarding ?? true },
    });
    console.log(t("setting.languageSaved", next));
    console.log(`${t("setting.current", next)}: lang=${next} (${t("setting.langDesc", next)})`);
    console.log(t("setting.settingsPath", next, { path: getSettingsPath() }));
  }

  if (choice === "projectRoot") {
    const root = settings.projectRoot?.path ?? resolve(process.cwd(), "project");
    const picked = await promptProjectRoot(currentLang, root);
    if (!picked) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    await saveSettings({
      ...settings,
      projectRoot: { path: picked, setupDone: true, onboarding: settings.projectRoot?.onboarding ?? true },
    });
    console.log(
      t("setting.projectRootSaved", currentLang, { path: picked }),
    );
  }

  return;
}
