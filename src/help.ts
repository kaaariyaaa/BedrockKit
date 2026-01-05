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
    "  -h, --help          Show help",
    "  -v, --version       Show version",
    "  -i, --interactive   Launch arrow-key menu",
    "  --config <path>     Use config file (json/ts/mjs/js)",
    "  --json              Machine-readable output (build/package/sync/validate)",
    "  -q, --quiet         Suppress non-error logs (build/package/sync/validate)",
    "  --build=false       Skip pre-build for sync/package (default: true)",
    "",
    ".bkitignore:",
    "  Supports simple patterns with * wildcard and # comments.",
    "  Example:",
    "    dist/",
    "    node_modules/",
    "    *.log",
    "    /.git",
  ];
  console.log(lines.join("\n"));
}
