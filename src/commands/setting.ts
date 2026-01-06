import { select, text, isCancel } from "@clack/prompts";
import { resolve } from "node:path";
import type { CommandContext, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang, t } from "../utils/i18n.js";
import {
  loadSettings,
  saveSettings,
  getSettingsPath,
  resolveOnboardingOrder,
  promptLangSelection,
  promptProjectRoot,
  type SettingKey,
} from "../utils/settings.js";

export async function handleSetting(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const settings = await loadSettings();
  const currentLang = settings.lang?.value ?? ctx.lang ?? resolveLang(parsed.flags.lang);
  // Flags: --lang <ja|en>
  const langFlag = parsed.flags.lang as string | undefined;
  const setupLangFlag = parsed.flags["setup-lang"] as string | boolean | undefined;
  const setupRootFlag = parsed.flags["setup-project-root"] as string | boolean | undefined;
  const projectRootFlag = parsed.flags["project-root"] as string | undefined;
  const orderFlag = parsed.flags["onboarding-order"] as string | undefined;

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
  if (setupLangFlag !== undefined) {
    const enabled = setupLangFlag === true || String(setupLangFlag).toLowerCase() === "true";
    nextSettings.lang = {
      value: settings.lang?.value,
      setupDone: settings.lang?.setupDone,
      onboarding: enabled,
    };
    updated = true;
  }
  if (setupRootFlag !== undefined) {
    const enabled = setupRootFlag === true || String(setupRootFlag).toLowerCase() === "true";
    nextSettings.projectRoot = {
      path: settings.projectRoot?.path,
      setupDone: settings.projectRoot?.setupDone,
      onboarding: enabled,
    };
    updated = true;
  }
  if (orderFlag) {
    const order = orderFlag
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is SettingKey => v === "lang" || v === "projectRoot");
    if (order.length) {
      nextSettings.onboardingOrder = order;
      updated = true;
    }
  }

  if (updated) {
    await saveSettings(nextSettings);
    console.log(t("setting.current", currentLang));
    console.log(`- lang.onboarding: ${nextSettings.lang?.onboarding ?? true}`);
    console.log(`- projectRoot.onboarding: ${nextSettings.projectRoot?.onboarding ?? true}`);
    console.log(`- projectRoot: ${nextSettings.projectRoot?.path ?? "(unset)"}`);
    if (nextSettings.onboardingOrder?.length) {
      console.log(`- onboardingOrder: ${nextSettings.onboardingOrder.join(", ")}`);
    }
    return;
  }

  const choice = await select({
    message: t("setting.selectItem", currentLang),
    options: [
      { value: "lang", label: t("setting.language", currentLang), hint: t("setting.langDesc", currentLang) },
      { value: "projectRoot", label: t("setting.projectRoot", currentLang), hint: "project root path" },
      { value: "langSetup", label: t("setting.langSetup", currentLang), hint: t("setting.langSetupHint", currentLang) },
      { value: "rootSetup", label: t("setting.rootSetup", currentLang), hint: t("setting.rootSetupHint", currentLang) },
      { value: "order", label: t("setting.onboardingOrder", currentLang), hint: t("setting.onboardingOrderHint", currentLang) },
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
    console.log(`settings: ${getSettingsPath()}`);
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
    console.log(`${t("setting.current", currentLang)}: projectRoot=${picked}`);
  }

  if (choice === "langSetup" || choice === "rootSetup") {
    const setupChoice = await select({
      message: t("setting.setupPrompt", currentLang),
      options: [
        { value: "true", label: "true" },
        { value: "false", label: "false" },
      ],
      initialValue:
        choice === "langSetup"
          ? settings.lang?.onboarding === false
            ? "false"
            : "true"
          : settings.projectRoot?.onboarding === false
            ? "false"
            : "true",
    });
    if (isCancel(setupChoice)) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    const enabled = String(setupChoice) === "true";
    if (choice === "langSetup") {
      await saveSettings({
        ...settings,
        lang: { value: settings.lang?.value, setupDone: settings.lang?.setupDone, onboarding: enabled },
      });
      console.log(`${t("setting.current", currentLang)}: lang.onboarding=${enabled}`);
    } else {
      await saveSettings({
        ...settings,
        projectRoot: {
          path: settings.projectRoot?.path,
          setupDone: settings.projectRoot?.setupDone,
          onboarding: enabled,
        },
      });
      console.log(`${t("setting.current", currentLang)}: projectRoot.onboarding=${enabled}`);
    }
  }

  if (choice === "order") {
    const currentOrder = resolveOnboardingOrder(settings);
    const input = await text({
      message: t("setting.onboardingOrderPrompt", currentLang),
      initialValue: currentOrder.join(","),
      validate: (v) => (!v.trim() ? t("common.required", currentLang) : undefined),
    });
    if (isCancel(input)) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    const order = String(input)
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is SettingKey => v === "lang" || v === "projectRoot");
    if (!order.length) {
      console.log(t("common.cancelled", currentLang));
      return;
    }
    await saveSettings({ ...settings, onboardingOrder: order });
    console.log(`${t("setting.current", currentLang)}: onboardingOrder=${order.join(", ")}`);
  }
}
