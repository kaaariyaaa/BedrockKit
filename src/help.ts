import pc from "picocolors";
import type { Command } from "./types.js";
import type { Lang } from "./types.js";
import { t } from "./utils/i18n.js";

export function printHelp(commands: Command[], lang: Lang): void {
  const lines = [
    pc.bold(pc.cyan(t("help.title", lang))),
    "",
    pc.bold(t("help.usage", lang)),
    `  ${pc.green("bkit")} ${t("help.usageCommand", lang)}`,
    `  ${pc.green("bkit")} ${t("help.usageInteractive", lang)}`,
    "",
    pc.bold(t("help.commands", lang)),
    ...commands.map((cmd) => {
      const alias = cmd.aliases?.length ? pc.dim(` (${cmd.aliases.join(", ")})`) : "";
      return `  ${pc.cyan(cmd.name)}${alias.padEnd(12 - cmd.name.length)} ${cmd.description}`;
    }),
    "",
    pc.bold(t("help.flags", lang)),
    `  ${pc.yellow("-h, --help")}          ${t("help.flag.help", lang)}`,
    `  ${pc.yellow("-v, --version")}       ${t("help.flag.version", lang)}`,
    `  ${pc.yellow("-i, --interactive")}   ${t("help.flag.interactive", lang)}`,
    `  ${pc.yellow("--json")}              ${t("help.flag.json", lang)}`,
    `  ${pc.yellow("-q, --quiet")}         ${t("help.flag.quiet", lang)}`,
    `  ${pc.yellow("--build=false")}       ${t("help.flag.build", lang)}`,
    "",
    pc.bold(t("help.bkitignore", lang)),
    `  ${t("help.bkitignoreDesc", lang)}`,
    `  ${t("help.bkitignoreExample", lang)}`,
    pc.dim("    dist/"),
    pc.dim("    node_modules/"),
    pc.dim("    *.log"),
    pc.dim("    /.git"),
  ];
  console.log(lines.join("\n"));
}

