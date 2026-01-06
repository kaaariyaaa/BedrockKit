import pc from "picocolors";
import type { Command } from "./types.js";

export function printHelp(commands: Command[]): void {
  const lines = [
    pc.bold(pc.cyan("BedrockKit CLI")),
    "",
    pc.bold("Usage:"),
    `  ${pc.green("bkit")} <command> [...args]`,
    `  ${pc.green("bkit")} -i|--interactive`,
    "",
    pc.bold("Commands:"),
    ...commands.map((cmd) => {
      const alias = cmd.aliases?.length ? pc.dim(` (${cmd.aliases.join(", ")})`) : "";
      return `  ${pc.cyan(cmd.name)}${alias.padEnd(12 - cmd.name.length)} ${cmd.description}`;
    }),
    "",
    pc.bold("Flags:"),
    `  ${pc.yellow("-h, --help")}          Show help`,
    `  ${pc.yellow("-v, --version")}       Show version`,
    `  ${pc.yellow("-i, --interactive")}   Launch arrow-key menu`,
    `  ${pc.yellow("--json")}              Machine-readable output (build/package/sync/validate)`,
    `  ${pc.yellow("-q, --quiet")}         Suppress non-error logs (build/package/sync/validate)`,
    `  ${pc.yellow("--build=false")}       Skip pre-build for sync/package (default: true)`,
    "",
    pc.bold(".bkitignore:"),
    "  Supports simple patterns with * wildcard and # comments.",
    "  Example:",
    pc.dim("    dist/"),
    pc.dim("    node_modules/"),
    pc.dim("    *.log"),
    pc.dim("    /.git"),
  ];
  console.log(lines.join("\n"));
}

