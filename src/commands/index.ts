import { handleInit } from "./init.js";
import { handleTemplate } from "./template.js";
import { handleValidate } from "./validate.js";
import { handleBump } from "./bump.js";
import { handlePackage } from "./package.js";
import { handleBuild } from "./build.js";
import { handleDeps } from "./deps.js";
import { handleSync } from "./sync.js";
import { handleImport } from "./import.js";
import { handleWatch } from "./watch.js";
import { handleLink } from "./link.js";
import { handleRemove } from "./remove.js";
import type { Command, Lang } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { t } from "../utils/i18n.js";
import { handleSetting } from "./setting.js";

export function buildCommands(lang: Lang, onHelp: () => void): Command[] {
  return [
    {
      name: "create",
      aliases: ["new"],
      description: t("command.create.desc", lang),
      run: handleInit,
    },
    {
      name: "bump",
      description: t("command.bump.desc", lang),
      run: handleBump,
    },
    {
      name: "template",
      description: t("command.template.desc", lang),
      run: handleTemplate,
    },
    {
      name: "import",
      description: t("command.import.desc", lang),
      run: handleImport,
    },

    {
      name: "validate",
      description: t("command.validate.desc", lang),
      run: handleValidate,
    },
    {
      name: "build",
      description: t("command.build.desc", lang),
      run: handleBuild,
    },
    {
      name: "package",
      description: t("command.package.desc", lang),
      run: handlePackage,
    },
    {
      name: "deps",
      description: t("command.deps.desc", lang),
      run: handleDeps,
    },
    {
      name: "sync",
      description: t("command.sync.desc", lang),
      run: handleSync,
    },
    {
      name: "link",
      description: t("command.link.desc", lang),
      run: handleLink,
    },
    {
      name: "watch",
      description: t("command.watch.desc", lang),
      run: handleWatch,
    },
    {
      name: "setting",
      description: t("command.setting.desc", lang),
      run: handleSetting,
    },
    {
      name: "remove",
      aliases: ["rm"],
      description: t("command.remove.desc", lang),
      run: handleRemove,
    },
    {
      name: "help",
      description: t("command.help.desc", lang),
      run: onHelp,
    },
  ];
}
