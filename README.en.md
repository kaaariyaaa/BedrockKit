# BedrockKit

A CLI tool for all-in-one Minecraft Bedrock Edition addon/resource pack development. Manage initialization, dependency management, building, packaging, and syncing to your development environment with the `bkit` command. The interactive UI is powered by OpenTUI.

[日本語版はこちら (Japanese version is here)](./README.md)

## Requirements
- **Bun**: 1.1 or higher (to run the CLI; `bun`/`bun.exe` must be on PATH)
- **Node.js**: 20 or higher (builds and related tools)
- **npm / git**: Used for template fetching and dependency installation
- **OS**: Compatible with Windows, macOS, and Linux. Appropriate permissions are required when syncing to game development folders.

## Installation
Install globally from GitHub:

```bash
npm i -g @bedrockkit/cli
```

If you want to use a local clone:

```bash
git clone https://github.com/kaaariyaaa/BedrockKit.git
cd BedrockKit
npm install
npm run build
npm install -g .   # or "npm link" for local linking
```

For direct testing from source during development, run `src/cli.ts` with `bun run src/cli.ts -- <command>`.

## Quick Start
```bash
# Interactively initialize a project (extracted under ./project/<name>)
bkit create

# Build and create outputs in dist/
bkit build <project>

# Sync build outputs to development folder
bkit sync <project>

# Create .mcpack/.mcaddon for distribution
bkit package <project>
```

## Terminal UI
- Uses OpenTUI for interactive flows (TTY only).
- Non-interactive flags (`--yes`, `--json`, `--quiet`) keep output minimal.

## Example Structure
The standard structure created by `bkit create` is as follows:

```
project/<addon-name>/
├─ bkit.config.json        # bkit configuration
├─ .bkitignore             # Exclusion settings for build/sync
├─ packs/
│  ├─ behavior/            # Behavior Pack
│  │  ├─ manifest.json
│  │  └─ scripts/main.ts   # Script entry (if selected)
│  └─ resource/            # Resource Pack
│     └─ manifest.json
└─ dist/                   # Output destination for build/package
```

Minimal example of `bkit.config.json`:

```json
{
  "project": { "name": "example-addon", "version": "1.0.0" },
  "template": "bkit-default",
  "packSelection": { "behavior": true, "resource": true },
  "packs": { "behavior": "packs/behavior", "resource": "packs/resource" },
  "build": { "outDir": "dist", "target": "dev" },
  "sync": {
    "defaultTarget": "gdk",
    "targets": { "gdk": { "product": "BedrockGDK", "projectName": "example-addon" } }
  },
  "paths": { "root": "." },
  "script": {
    "entry": "packs/behavior/scripts/main.ts",
    "language": "typescript",
    "dependencies": [{ "module_name": "@minecraft/server", "version": "1.11.0" }],
    "apiVersion": "1.11.0"
  }
}
```

## Main Commands
- `bkit create` (`new`) : Create a workspace from a template. You can interactively select Script API packages and versions. ESLint rules can be toggled interactively or via `--eslint-rules <csv>` / `--no-eslint` flags.
- `bkit import <mcpack|mcaddon|zip>` : Extract an existing archive and generate `bkit.config.json` for workspace conversion. JS to TS conversion is optional (`--convert-ts`). Automatic conversion is recommended only when necessary due to compatibility risks.
- `bkit build [--out-dir <dir>]` : Copy packs to `dist/`. If scripts are in TypeScript, they are bundled using `@minecraft/core-build-tasks`.
- `bkit package [--out <name>]` : Create `.mcpack` (both packs) or `.mcaddon` (if both exist) from the `dist/` folder.
- `bkit sync [--target <name>] [--build=false]` : Copy build outputs to locations defined in `config.sync.targets`. Specifying `product` allows deployment to Minecraft development environments.
- `bkit link [<project>]` : Create/remove/recreate symlinks in development folders. If `<project>` is provided, it resolves `bkit.config.json` from that project; otherwise it prompts you to select one. The action (create/remove/edit) is selected interactively, or you can force it via `--action create|remove|edit`. Supports `--source dist|packs`, `--mode symlink|junction`, and `--behavior/--resource`. If `dist` is missing it triggers a build.
- `bkit deps` : Install selected Script API dependencies via npm and sync `bkit.config.json` and `manifest.json`.
- `bkit bump [major|minor|patch] [--to <version>] [--min-engine <x.y.z>]` : Update project/manifest versions (optionally override min_engine_version).
- `bkit validate [--strict] [--json]` : Check consistency between config and manifest files.
- `bkit template <list|add|pull|rm>` : Manage the template registry (`.bkit/templates*.json`). Any repository can be registered as `custom-git`.
- `bkit watch` : Watch the project folder and automatically perform build and sync on changes. Link mode shares non-script assets via symlink and copies built JS into `scripts`.
- `bkit setting [--lang <ja|en>] [--project-root <path>]` : Manage CLI settings (language, project root). Prompts when no flags are provided.
- `bkit remove [--project <name>]` : Remove a project folder (use `--yes` to skip confirmation). It also tries to clean up symlinks inside the target sync folders before deletion.
- `npm run build:local` / `npm run package:local` : Each generated/imported project ships with `tools/local-build.mjs` and `tools/local-package.mjs`. You can build and create `.mcpack/.mcaddon` archives without the BedrockKit CLI.

## Sync Targets
- **Via core-build-tasks** (Deploy to dev Minecraft)  
  Specify product type in `sync.targets.<name>.product` (`BedrockUWP | PreviewUWP | BedrockGDK | PreviewGDK`). You can override the project folder name with `projectName`.
- **Path-based Copy**  
  Specify direct paths in `sync.targets.<name>.behavior` / `resource`. Use `bkit sync --dry-run` to check the operations without copying.

## Template Management
- `official-sample` is registered by default. Check via `bkit template list`.
- Register any Git repository with `bkit template add <name> <git-url>` and use it via `bkit create --template <name>`.
- Templates are cloned to `.bkit/templates/<name>`. Private repositories are supported (SSH keys can be specified via `BKIT_SSH_KEY`).

## Useful Options
- **--config <path>**: Specify the target project. If multiple projects exist, you can select one interactively.
- **--json**: Output in machine-readable JSON format.
- **-q | --quiet**: Suppress log output.
- **--lang <ja|en>**: Toggle display language (default is Japanese). Environment variable `BKIT_LANG` is also supported.
- **--build=false**: Common option to skip the pre-build step.
- **.bkitignore**: Patterns listed in `.bkitignore` are ignored during build and sync.

## Common Workflow
1. `bkit create`: Initialize a project.
2. `bkit build`: Build the project.
3. `bkit sync` or `bkit watch`: Sync to the development environment.
4. `bkit package`: Generate distribution archives.
