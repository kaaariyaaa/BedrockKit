export const DEFAULT_BKIT_IGNORE: string[] = [
  "# Build output",
  "dist/",
  "",
  "# Dependencies",
  "node_modules/",
  "",
  "# VCS / editor",
  ".git/",
  ".vscode/",
  ".idea/",
  ".DS_Store",
  "Thumbs.db",
  "",
  "# Logs / temp",
  "*.log",
  "*.tmp",
];

export const DEFAULT_GIT_IGNORE: string[] = [
  "# Logs",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "pnpm-debug.log*",
  "",
  "# Dependencies",
  "node_modules/",
  "",
  "# Build outputs",
  "dist/",
  ".watch-dist/",
  "",
  "# Env / cache",
  ".env",
  ".env.local",
  ".bkit/",
  "",
  "# IDE / OS",
  ".vscode/",
  ".idea/",
  ".DS_Store",
  "Thumbs.db",
];

export function buildIgnoreFileContent(lines: string[]): string {
  return `${lines.filter(Boolean).join("\n")}\n`;
}
