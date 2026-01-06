import { isCancel, select, text } from "@clack/prompts";
import { fetchNpmVersionChannels, formatVersionLabel } from "../utils/npm.js";
import { t } from "../utils/i18n.js";
import type { Lang, ScriptApiSelection, ScriptApiVersionMap } from "../types.js";

export const SCRIPT_API_OPTIONS: {
  key: keyof ScriptApiVersionMap;
  pkg: string;
  label: string;
  hint: string;
}[] = [
  { key: "server", pkg: "@minecraft/server", label: "@minecraft/server", hint: "Core Script API" },
  { key: "serverUi", pkg: "@minecraft/server-ui", label: "@minecraft/server-ui", hint: "UI helpers" },
  { key: "common", pkg: "@minecraft/common", label: "@minecraft/common", hint: "Shared utilities" },
  { key: "math", pkg: "@minecraft/math", label: "@minecraft/math", hint: "Math helpers" },
  { key: "serverNet", pkg: "@minecraft/server-net", label: "@minecraft/server-net", hint: "Net helpers" },
  { key: "serverGametest", pkg: "@minecraft/server-gametest", label: "@minecraft/server-gametest", hint: "Gametest API" },
  { key: "serverAdmin", pkg: "@minecraft/server-admin", label: "@minecraft/server-admin", hint: "Admin API" },
  { key: "debugUtilities", pkg: "@minecraft/debug-utilities", label: "@minecraft/debug-utilities", hint: "Debug helpers" },
  { key: "vanillaData", pkg: "@minecraft/vanilla-data", label: "@minecraft/vanilla-data", hint: "Vanilla constants" },
];

export const SCRIPT_API_PACKAGES = new Set(
  SCRIPT_API_OPTIONS.map((entry) => entry.pkg),
);

export const MANIFEST_SCRIPT_PACKAGES = new Set(
  SCRIPT_API_OPTIONS
    .filter((entry) => entry.pkg !== "@minecraft/math" && entry.pkg !== "@minecraft/vanilla-data")
    .map((entry) => entry.pkg),
);

export function defaultScriptApiSelection(): ScriptApiSelection {
  return {
    server: true,
    serverUi: true,
    common: false,
    math: false,
    serverNet: false,
    serverGametest: false,
    serverAdmin: false,
    debugUtilities: false,
    vanillaData: false,
  };
}

type VersionCache = Map<
  string,
  {
    channel: string;
    versions: string[];
  }
>;

async function resolveVersionBucket(pkg: string, cache: VersionCache): Promise<void> {
  if (cache.has(pkg)) return;
  const channels = await fetchNpmVersionChannels(pkg, { limit: 15 });
  cache.set(pkg, {
    channel: "stable",
    versions: channels.stable.length
      ? channels.stable
      : [...channels.beta, ...channels.alpha, ...channels.preview, ...channels.other],
  });
  cache.set(`${pkg}:beta`, { channel: "beta", versions: channels.beta });
  cache.set(`${pkg}:alpha`, { channel: "alpha", versions: channels.alpha });
  cache.set(`${pkg}:preview`, { channel: "preview", versions: channels.preview });
  cache.set(`${pkg}:other`, { channel: "other", versions: channels.other });
}

async function pickManualVersion(pkg: string, lang: Lang, current: string): Promise<string | null> {
  const manual = await text({
    message: t("init.selectVersion", lang, { pkg, channel: "manual" }),
    initialValue: current,
    validate: (v) => (!v.trim() ? t("common.required", lang) : undefined),
  });
  return isCancel(manual) ? null : manual.trim();
}

export function createScriptApiVersionPicker(lang: Lang) {
  const cache: VersionCache = new Map();
  return async (pkg: string, current: string): Promise<string | null> => {
    await resolveVersionBucket(pkg, cache);

    const channelChoice = await select({
      message: t("init.selectChannel", lang, { pkg }),
      options: [
        { value: "stable", label: "stable" },
        { value: "beta", label: "beta" },
        { value: "alpha", label: "alpha" },
        { value: "preview", label: "preview" },
        { value: "other", label: "other" },
        { value: "__manual__", label: t("common.enterManually", lang) },
      ],
      initialValue: "stable",
    });
    if (isCancel(channelChoice)) return null;

    if (channelChoice === "__manual__") {
      return pickManualVersion(pkg, lang, current);
    }

    const bucket = channelChoice === "stable" ? cache.get(pkg) : cache.get(`${pkg}:${channelChoice}`);
    const versions = bucket?.versions ?? [];
    if (!versions.length) {
      return pickManualVersion(pkg, lang, current);
    }

    const choice = await select({
      message: t("init.selectVersion", lang, { pkg, channel: String(channelChoice) }),
      options: [
        ...versions.map((v) => ({ value: v, label: formatVersionLabel(v) })),
        { value: "__manual__", label: t("common.enterManually", lang) },
      ],
      initialValue: versions[0] ?? current,
    });
    if (isCancel(choice)) return null;
    if (choice === "__manual__") {
      return pickManualVersion(pkg, lang, current);
    }
    return String(choice);
  };
}

export function toScriptApiSelection(values: Iterable<string>): ScriptApiSelection {
  const set = new Set(values);
  return {
    server: set.has("server") || set.has("@minecraft/server"),
    serverUi: set.has("serverUi") || set.has("@minecraft/server-ui"),
    common: set.has("common") || set.has("@minecraft/common"),
    math: set.has("math") || set.has("@minecraft/math"),
    serverNet: set.has("serverNet") || set.has("@minecraft/server-net"),
    serverGametest: set.has("serverGametest") || set.has("@minecraft/server-gametest"),
    serverAdmin: set.has("serverAdmin") || set.has("@minecraft/server-admin"),
    debugUtilities: set.has("debugUtilities") || set.has("@minecraft/debug-utilities"),
    vanillaData: set.has("vanillaData") || set.has("@minecraft/vanilla-data"),
  };
}
