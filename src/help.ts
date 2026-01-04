import type { Command } from "./types.js";

export function printHelp(commands: Command[]): void {
  const lines = [
    "BedrockKit CLI",
    "",
    "Usage:",
    "  bkit <command> [...args]",
    "  bkit -i|--interactive",
    "",
    "Commands:",
    ...commands.map((cmd) => {
      const alias = cmd.aliases?.length ? ` (${cmd.aliases.join(", ")})` : "";
      return `  ${cmd.name}${alias.padEnd(12 - cmd.name.length)} ${cmd.description}`;
    }),
    "",
    "Flags:",
    "  -h, --help       Show help",
    "  -v, --version    Show version",
    "  -i, --interactive Launch arrow-key menu",
  ];
  console.log(lines.join("\n"));
}
