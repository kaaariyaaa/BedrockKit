import { select, isCancel } from "@clack/prompts";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang, t } from "../utils/i18n.js";
import { loadSettings, saveSettings, getSettingsPath } from "../utils/settings.js";

export async function handleSetting(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const settings = await loadSettings();
  const currentLang = settings.lang ?? ctx.lang ?? resolveLang(parsed.flags.lang);
  // Flags: --lang <ja|en>
  const langFlag = parsed.flags.lang as string | undefined;

  if (langFlag) {
    const next = langFlag === "en" ? "en" : "ja";
    await saveSettings({ ...settings, lang: next });
    console.log(t("setting.languageSaved", next));
    console.log(`${t("setting.current", next)}: lang=${next} (${t("setting.langDesc", next)})`);
    return;
  }

  const choice = await select({
    message: t("setting.selectItem", currentLang),
    options: [
      { value: "lang", label: t("setting.language", currentLang), hint: t("setting.langDesc", currentLang) },
    ],
  });
  if (isCancel(choice)) {
    console.log(t("common.cancelled", currentLang));
    return;
  }

  if (choice === "lang") {
    const langChoice = await select({
      message: t("setting.language", currentLang),
      options: [
        { value: "ja", label: "日本語" },
        { value: "en", label: "English" },
      ],
      initialValue: currentLang ?? "ja",
    });
    if (isCancel(langChoice)) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    const next = (langChoice as Lang) ?? "ja";
    await saveSettings({ ...settings, lang: next });
    console.log(t("setting.languageSaved", next));
    console.log(`${t("setting.current", next)}: lang=${next} (${t("setting.langDesc", next)})`);
    console.log(`settings: ${getSettingsPath()}`);
  }
}
