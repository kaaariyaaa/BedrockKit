import type { Lang } from "../types.js";

const dict: Record<string, Record<Lang, string>> = {
  "common.cancelled": {
    ja: "キャンセルしました。",
    en: "Cancelled.",
  },
  "common.done": {
    ja: "完了しました。",
    en: "Done.",
  },
  "common.enterManually": {
    ja: "手動入力",
    en: "Enter manually",
  },
  "common.required": {
    ja: "必須です",
    en: "Required",
  },
  "cli.menuPrompt": {
    ja: "実行するコマンドを選択してください",
    en: "What would you like to do?",
  },
  "cli.menuNotFound": {
    ja: "指定されたコマンドが見つかりません。",
    en: "Selected command not found.",
  },
  "cli.interactiveMode": {
    ja: "対話モード",
    en: "Interactive Mode",
  },
  "cli.unknownCommand": {
    ja: "不明なコマンドです: {name}",
    en: "Unknown command: {name}",
  },
  "common.configSelectionCancelled": {
    ja: "設定の選択をキャンセルしました。",
    en: "Config selection cancelled.",
  },
  "common.configNotFound": {
    ja: "設定ファイルが見つかりません: {path}",
    en: "Config not found: {path}",
  },
  "init.projectName": {
    ja: "プロジェクト名",
    en: "Project name",
  },
  "init.projectNameRequired": {
    ja: "プロジェクト名は必須です",
    en: "Project name is required",
  },
  "init.chooseTemplate": {
    ja: "テンプレートを選択",
    en: "Choose a template",
  },
  "init.selectPacks": {
    ja: "生成するパックを選択",
    en: "Select packs to generate",
  },
  "init.includeScript": {
    ja: "スクリプトを含めますか？",
    en: "Include script module?",
  },
  "init.selectPackages": {
    ja: "含める Script API パッケージを選択（スペースで切替）",
    en: "Select Script API packages to include (space to toggle)",
  },
  "init.selectChannel": {
    ja: "{pkg} のチャンネル",
    en: "{pkg} channel",
  },
  "init.selectVersion": {
    ja: "{pkg} のバージョン ({channel})",
    en: "{pkg} version ({channel})",
  },
  "init.installDeps": {
    ja: "依存関係をインストールしますか？",
    en: "Install dependencies?",
  },
  "init.enableEslintRules": {
    ja: "有効にする ESLint ルール（スペースで切替）",
    en: "Enable ESLint rules (space to toggle)",
  },
  "init.pack.behavior": {
    ja: "ビヘイビアパック",
    en: "Behavior Pack",
  },
  "init.pack.resource": {
    ja: "リソースパック",
    en: "Resource Pack",
  },
  "init.packsRequired": {
    ja: "少なくとも1つは選択してください。",
    en: "At least one pack must be selected.",
  },
  "init.generating": {
    ja: "ワークスペースを作成しています",
    en: "Initializing workspace",
  },
  "init.title": {
    ja: "BedrockKit Init",
    en: "BedrockKit Init",
  },
  "init.templateUrlPrompt": {
    ja: "テンプレートの Git URL を入力",
    en: "Enter Git URL for template",
  },
  "init.summary": {
    ja: "ワークスペースを作成しました",
    en: "Created workspace",
  },
  "init.installingDeps": {
    ja: "依存関係をインストールしています",
    en: "Installing dependencies",
  },
  "init.installFailed": {
    ja: "依存関係のインストールに失敗しました（インストールせずに続行）",
    en: "Failed to install dependencies (continuing without install)",
  },
  "init.installCompleted": {
    ja: "依存関係をインストールしました",
    en: "Dependencies installed",
  },
  "init.installSkipped": {
    ja: "依存関係のインストールをスキップしました（--skip-install で制御できます）",
    en: "Skipped dependency install (use --skip-install to control this).",
  },
  "init.installOption.npmInstall": {
    ja: "npm install",
    en: "npm install",
  },
  "init.installOption.npmCi": {
    ja: "npm ci",
    en: "npm ci",
  },
  "init.installOption.pnpmInstall": {
    ja: "pnpm install",
    en: "pnpm install",
  },
  "init.installOption.yarnInstall": {
    ja: "yarn install",
    en: "yarn install",
  },
  "init.installOption.skip": {
    ja: "スキップ",
    en: "Skip",
  },
  "init.targetNotEmpty": {
    ja: "ターゲットディレクトリが空ではありません: {path}。続行するには --force を使用してください。",
    en: "Target directory {path} is not empty. Use --force to initialize anyway.",
  },
  "init.writeFailed": {
    ja: "ファイルの書き込みに失敗しました",
    en: "Failed to write files",
  },
  "init.summary.created": {
    ja: "ワークスペースを作成しました: {path}",
    en: "Created workspace at {path}",
  },
  "init.summary.behaviorManifest": {
    ja: "- ビヘイビアパック manifest: packs/behavior/manifest.json",
    en: "- behavior pack manifest: packs/behavior/manifest.json",
  },
  "init.summary.resourceManifest": {
    ja: "- リソースパック manifest: packs/resource/manifest.json",
    en: "- resource pack manifest: packs/resource/manifest.json",
  },
  "init.summary.config": {
    ja: "- config: bkit.config.json",
    en: "- config: bkit.config.json",
  },
  "init.summary.scriptEntry": {
    ja: "- スクリプトエントリ: {entry} (language: {language}, api: {api}, dependencies: {deps})",
    en: "- script entry: {entry} (language: {language}, api: {api}, dependencies: {deps})",
  },
  "init.summary.installCompleted": {
    ja: "- {command} 完了",
    en: "- {command} completed",
  },
  "init.summary.installSkipped": {
    ja: "- {command} スキップ",
    en: "- {command} skipped",
  },
  "init.summary.installFailed": {
    ja: "- {command} 失敗（上のログ参照）",
    en: "- {command} failed (see log above)",
  },
  "init.packageDescription": {
    ja: "BedrockKit アドオンプロジェクト",
    en: "BedrockKit addon project",
  },
  "package.runBuild": {
    ja: "パッケージング前にビルドを実行しますか？",
    en: "Run build before packaging?",
  },
  "package.runBuildNow": {
    ja: "パッケージング前にビルドを実行しています...",
    en: "Running build before packaging...",
  },
  "package.buildDirNotFound": {
    ja: "ビルドディレクトリが見つかりません: {path}",
    en: "Build directory not found: {path}",
  },
  "package.buildPathNotDir": {
    ja: "ビルドパスがディレクトリではありません: {path}",
    en: "Build path is not a directory: {path}",
  },
  "package.packaging": {
    ja: "パッケージ作成: '{buildDir}' -> '{behaviorOut}', '{resourceOut}'",
    en: "Packaging '{buildDir}' -> '{behaviorOut}', '{resourceOut}'",
  },
  "package.behaviorCreated": {
    ja: "ビヘイビアパック作成: {path}",
    en: "Behavior pack created: {path}",
  },
  "package.resourceCreated": {
    ja: "リソースパック作成: {path}",
    en: "Resource pack created: {path}",
  },
  "package.addonCreated": {
    ja: "mcaddon 作成: {path}",
    en: "Mcaddon created: {path}",
  },
  "package.failed": {
    ja: "パッケージ作成に失敗しました: {error}",
    en: "Failed to create package: {error}",
  },
  "package.zipTaskMissing": {
    ja: "@minecraft/core-build-tasks に zipTask が見つかりません",
    en: "zipTask not found in @minecraft/core-build-tasks",
  },
  "package.cancelled": {
    ja: "パッケージングを中止しました。",
    en: "Packaging cancelled.",
  },
  "deps.selectPackages": {
    ja: "含める Script API パッケージを選択（スペースで切替）",
    en: "Select Script API packages to include (space to toggle)",
  },
  "deps.noScriptConfig": {
    ja: "bkit.config.json に script 設定がありません。",
    en: "No script configuration found in bkit.config.json.",
  },
  "deps.packageJsonNotFound": {
    ja: "package.json が見つかりません: {path}",
    en: "package.json not found: {path}",
  },
  "deps.npmUninstall": {
    ja: "npm uninstall {packages}",
    en: "npm uninstall {packages}",
  },
  "deps.npmInstall": {
    ja: "npm install {packages}",
    en: "npm install {packages}",
  },
  "deps.noChanges": {
    ja: "npm 依存関係の変更はありません。",
    en: "No changes to npm dependencies.",
  },
  "deps.behaviorManifestNotFound": {
    ja: "ビヘイビアマニフェストが見つかりません: {path}",
    en: "Behavior manifest not found: {path}",
  },
  "deps.updated": {
    ja: "Script API パッケージを更新しました。",
    en: "Updated Script API packages.",
  },
  "import.pathPrompt": {
    ja: ".mcpack/.mcaddon/.zip へのパス",
    en: "Path to .mcpack/.mcaddon/.zip",
  },
  "import.pathRequired": {
    ja: "パスは必須です",
    en: "Path is required",
  },
  "import.projectName": {
    ja: "プロジェクト名",
    en: "Project name",
  },
  "import.projectNameRequired": {
    ja: "プロジェクト名は必須です",
    en: "Project name is required",
  },
  "import.overwrite": {
    ja: "既存のディレクトリがあります。上書きしますか？",
    en: "Target exists. Overwrite?",
  },
  "import.convertQuestion": {
    ja: "スクリプトを TypeScript (.js -> .ts) に変換しますか？（任意、手動修正が必要になる場合があります）",
    en: "Convert scripts to TypeScript (.js -> .ts)? (optional; may require manual fixes)",
  },
  "import.intro": {
    ja: "プロジェクトをインポート中",
    en: "Importing project",
  },
  "import.extractFailed": {
    ja: "アーカイブの展開に失敗しました (code {code})",
    en: "Failed to extract archive (code {code})",
  },
  "import.unzipFailed": {
    ja: "アーカイブの展開に失敗しました (code {code})",
    en: "Failed to extract archive (code {code})",
  },
  "import.packageDescription": {
    ja: "取り込み済み Bedrock アドオンプロジェクト",
    en: "Imported Bedrock addon project",
  },
  "sync.runBuild": {
    ja: "同期前にビルドを実行しますか？",
    en: "Run build before sync?",
  },
  "sync.runBuildNow": {
    ja: "同期前にビルドを実行しています...",
    en: "Running build before sync...",
  },
  "sync.cancelled": {
    ja: "同期を中止しました。",
    en: "Sync cancelled.",
  },
  "sync.buildOutputNotFound": {
    ja: "ビルド出力が見つかりません: {path}",
    en: "Build output not found: {path}",
  },
  "sync.behaviorOutputNotFound": {
    ja: "ビヘイビアのビルド出力が見つかりません: {path}",
    en: "Behavior build output not found: {path}. Run 'bkit build' first.",
  },
  "sync.resourceOutputNotFound": {
    ja: "リソースのビルド出力が見つかりません: {path}",
    en: "Resource build output not found: {path}. Run 'bkit build' first.",
  },
  "sync.noTargets": {
    ja: "同期先が未設定です（config.sync.targets が空です）。",
    en: "No sync targets defined in config.sync.targets.",
  },
  "sync.selectTarget": {
    ja: "同期先を選択",
    en: "Select sync target",
  },
  "sync.dryRunProduct": {
    ja: "[dry-run] core-build-tasks で {product} に配備予定 ({project})",
    en: "[dry-run] Would deploy via core-build-tasks to {product} as {project}",
  },
  "sync.copyTaskMissing": {
    ja: "copyTask が @minecraft/core-build-tasks に見つかりません",
    en: "copyTask not found in @minecraft/core-build-tasks",
  },
  "sync.syncedProduct": {
    ja: "core-build-tasks で {product} に同期しました (project: {project})",
    en: "Synced via core-build-tasks to {product} (project: {project})",
  },
  "sync.failed": {
    ja: "同期に失敗しました: {error}",
    en: "Sync failed: {error}",
  },
  "sync.targetMissingBehavior": {
    ja: "同期先 '{target}' に behavior パスがありません",
    en: "Target '{target}' missing behavior path in sync.targets",
  },
  "sync.targetMissingResource": {
    ja: "同期先 '{target}' に resource パスがありません",
    en: "Target '{target}' missing resource path in sync.targets",
  },
  "sync.dryRunSync": {
    ja: "[dry-run] 同期予定: {from} -> {to}",
    en: "[dry-run] Would sync {from} -> {to}",
  },
  "sync.synced": {
    ja: "同期完了: {from} -> {to}",
    en: "Synced {from} -> {to}",
  },
  "link.selectTarget": {
    ja: "リンク先を選択",
    en: "Select link target",
  },
  "link.selectAction": {
    ja: "実行する操作を選択",
    en: "Select link action",
  },
  "link.action.create": {
    ja: "リンクを作成",
    en: "Create links",
  },
  "link.action.remove": {
    ja: "リンクを解除",
    en: "Remove links",
  },
  "link.action.edit": {
    ja: "リンクを編集（再作成）",
    en: "Edit links (recreate)",
  },
  "link.selectSource": {
    ja: "リンク元を選択",
    en: "Select link source",
  },
  "link.source.dist": {
    ja: "dist（ビルド成果物）",
    en: "dist (build output)",
  },
  "link.source.packs": {
    ja: "packs（ソース）",
    en: "packs (source)",
  },
  "link.selectMode": {
    ja: "リンク方式を選択",
    en: "Select link type",
  },
  "link.buildingDist": {
    ja: "dist が見つからないためビルドを実行します...",
    en: "dist not found; running build...",
  },
  "link.mode.symlink": {
    ja: "symlink",
    en: "symlink",
  },
  "link.mode.junction": {
    ja: "junction（Windows向け）",
    en: "junction (Windows)",
  },
  "link.selectPacks": {
    ja: "リンクするパックを選択",
    en: "Select packs to link",
  },
  "link.confirmReplace": {
    ja: "既存のパスを置き換えますか？\n{path}",
    en: "Replace existing path?\n{path}",
  },
  "link.removed": {
    ja: "リンクを解除しました:",
    en: "Removed link:",
  },
  "link.skippedNotLink": {
    ja: "リンクではないためスキップ:",
    en: "Skipped (not a link):",
  },
  "link.notFound": {
    ja: "存在しないためスキップ:",
    en: "Skipped (not found):",
  },
  "link.targetMissingBehavior": {
    ja: "同期先 '{target}' に behavior パスがありません",
    en: "Target '{target}' missing behavior path in sync.targets",
  },
  "link.targetMissingResource": {
    ja: "同期先 '{target}' に resource パスがありません",
    en: "Target '{target}' missing resource path in sync.targets",
  },
  "link.noPacksSelected": {
    ja: "パックが選択されていません。",
    en: "No packs selected.",
  },
  "link.sourceNotFound": {
    ja: "リンク元が見つかりません: {path}",
    en: "Source path not found: {path}",
  },
  "link.skippedExists": {
    ja: "既に存在するためスキップ: {path}",
    en: "Skipped (already exists): {path}",
  },
  "link.linked": {
    ja: "リンク作成: {from} -> {to}",
    en: "Linked {from} -> {to}",
  },
  "link.dryRunLink": {
    ja: "[dry-run] リンク予定: {from} -> {to}",
    en: "[dry-run] Would link {from} -> {to}",
  },
  "link.dryRunRemove": {
    ja: "[dry-run] 削除予定: {path}",
    en: "[dry-run] Would remove {path}",
  },
  "link.noTargets": {
    ja: "config.sync.targets が空です。同期先を追加してください。",
    en: "No sync targets defined in config.sync.targets.",
  },
  "link.cancelled": {
    ja: "リンクを中止しました。",
    en: "Link cancelled.",
  },
  "watch.selectProjects": {
    ja: "監視するプロジェクトを選択",
    en: "Select projects to watch",
  },
  "watch.noProjectsFound": {
    ja: "プロジェクトが見つかりません: {path}",
    en: "No projects found under {path}",
  },
  "watch.noProjectsSelected": {
    ja: "プロジェクトが選択されていません。",
    en: "No projects selected.",
  },
  "watch.selectMode": {
    ja: "watch のビルド方式を選択",
    en: "Select watch build mode",
  },
  "watch.mode.copyRecommended": {
    ja: "copy（推奨）",
    en: "copy (recommended)",
  },
  "watch.mode.link": {
    ja: "link（シンボリックリンク）",
    en: "link (symlink)",
  },
  "watch.intro": {
    ja: "監視を開始します（変更で自動ビルド＋同期）",
    en: "Watching projects for changes (auto build + sync)",
  },
  "watch.recoverNotice": {
    ja: "前回の watch 状態を検出しました。最終成果物を確定しています...",
    en: "Detected leftover watch state. Finalizing outputs...",
  },
  "watch.recoverFailed": {
    ja: "watch 状態の復旧に失敗しました: {error}",
    en: "Failed to recover watch state: {error}",
  },
  "watch.finalizeNotice": {
    ja: "最終成果物を確定しています（copy）...",
    en: "Finalizing build outputs (copy)...",
  },
  "watch.outDir": {
    ja: "watch の出力先: {outDir} (mode: {mode})",
    en: "Using watch build outDir: {outDir} (mode: {mode})",
  },
  "watch.changeDetected": {
    ja: "[{name}] 変更検知 ({reason})、ビルド中...",
    en: "[{name}] change detected ({reason}), building...",
  },
  "watch.buildSyncCompleted": {
    ja: "[{name}] ビルドと同期が完了しました。",
    en: "[{name}] build+sync completed.",
  },
  "watch.buildSyncFailed": {
    ja: "[{name}] ビルドと同期に失敗しました: {error}",
    en: "[{name}] build+sync failed: {error}",
  },
  "watch.watching": {
    ja: "[{name}] 監視中: {paths}",
    en: "[{name}] watching {paths}",
  },
  "watch.finalizeUnlinkFailed": {
    ja: "[{name}] 終了時のリンク解除に失敗しました: {error}",
    en: "[{name}] finalize unlink failed: {error}",
  },
  "watch.finalizeSyncFailed": {
    ja: "[{name}] 終了時の同期に失敗しました: {error}",
    en: "[{name}] finalize sync step failed: {error}",
  },
  "watch.finalizeFailed": {
    ja: "[{name}] 終了処理に失敗しました: {error}",
    en: "[{name}] finalize build failed: {error}",
  },
  "watch.noSyncTargetSelected": {
    ja: "同期先が選択されていません。",
    en: "No sync target selected.",
  },
  "watch.syncTargetNotFound": {
    ja: "同期先が見つかりません: {target}",
    en: "Sync target not found: {target}",
  },
  "watch.targetMissingBehavior": {
    ja: "同期先 '{target}' に behavior パスがありません",
    en: "Target '{target}' missing behavior path in sync.targets",
  },
  "watch.targetMissingResource": {
    ja: "同期先 '{target}' に resource パスがありません",
    en: "Target '{target}' missing resource path in sync.targets",
  },
  "config.selectProject": {
    ja: "プロジェクトを選択",
    en: "Select project",
  },
  "template.commandPrompt": {
    ja: "テンプレートコマンドを選択",
    en: "Template command",
  },
  "template.option.list": {
    ja: "一覧",
    en: "List",
  },
  "template.option.add": {
    ja: "追加（Git URL）",
    en: "Add (Git URL)",
  },
  "template.option.pull": {
    ja: "更新",
    en: "Update",
  },
  "template.option.remove": {
    ja: "削除",
    en: "Remove",
  },
  "template.known": {
    ja: "[template] 登録済みテンプレート:",
    en: "[template] Known templates:",
  },
  "template.listEntry": {
    ja: "- {name} {url}{path}",
    en: "- {name} {url}{path}",
  },
  "template.listPath": {
    ja: " (path: {path})",
    en: " (path: {path})",
  },
  "template.registryFile": {
    ja: "Registry file: {path} (add/remove 時に自動作成)",
    en: "Registry file: {path} (auto-created on add/remove)",
  },
  "template.usageAdd": {
    ja: "使い方: template add <name> <git-url>",
    en: "Usage: template add <name> <git-url>",
  },
  "template.exists": {
    ja: "テンプレート '{name}' は既に存在します。",
    en: "Template '{name}' already exists.",
  },
  "template.registered": {
    ja: "[template] テンプレート '{name}' を登録しました: {url} (path: {path})",
    en: "[template] Registered template '{name}' from {url} (path: {path})",
  },
  "template.cloneFailed": {
    ja: "[template] テンプレートの取得に失敗しました: {error}",
    en: "[template] Failed to clone template: {error}",
  },
  "template.usageRemove": {
    ja: "使い方: template rm <name>",
    en: "Usage: template rm <name>",
  },
  "template.notFound": {
    ja: "テンプレート '{name}' が見つかりません。",
    en: "Template '{name}' not found.",
  },
  "template.removed": {
    ja: "[template] テンプレート '{name}' を削除しました",
    en: "[template] Removed template '{name}'",
  },
  "template.usagePull": {
    ja: "使い方: template pull <name>",
    en: "Usage: template pull <name>",
  },
  "template.updated": {
    ja: "[template] テンプレート '{name}' を更新しました: {url} (path: {path})",
    en: "[template] Updated '{name}' from {url} (path: {path})",
  },
  "template.updateFailed": {
    ja: "[template] テンプレートの更新に失敗しました: {error}",
    en: "[template] Failed to update template: {error}",
  },
  "template.unknownSubcommand": {
    ja: "不明なテンプレートコマンドです: {sub}",
    en: "Unknown template subcommand: {sub}",
  },
  "template.name": {
    ja: "テンプレート名",
    en: "Template name",
  },
  "template.url": {
    ja: "Git URL",
    en: "Git URL",
  },
  "template.nameRequired": {
    ja: "名前は必須です",
    en: "Name is required",
  },
  "template.urlRequired": {
    ja: "URL は必須です",
    en: "URL is required",
  },
  "template.removeConfirm": {
    ja: "テンプレート '{name}' を削除しますか？",
    en: "Remove template '{name}'?",
  },
  "template.nameToUpdate": {
    ja: "更新するテンプレート名",
    en: "Template name to update",
  },
  "template.aborted": {
    ja: "中断しました。",
    en: "Aborted.",
  },
  "bump.behaviorManifestMissing": {
    ja: "ビヘイビアマニフェストが見つかりません: {path}",
    en: "Behavior manifest not found: {path}",
  },
  "bump.resourceManifestMissing": {
    ja: "リソースマニフェストが見つかりません: {path}",
    en: "Resource manifest not found: {path}",
  },
  "command.init.desc": {
    ja: "テンプレートから新規ワークスペースを作成",
    en: "Initialize a new Bedrock addon/resource pack workspace from a template",
  },
  "command.bump.desc": {
    ja: "バージョンを更新し、マニフェスト等を再生成",
    en: "Bump version and regenerate manifest/version metadata",
  },
  "command.template.desc": {
    ja: "プロジェクトのテンプレートを管理（list/add/rm/pull）",
    en: "Manage templates (list/add/rm) for project scaffolding",
  },
  "command.import.desc": {
    ja: "既存の mcpack/mcaddon/zip をプロジェクトとして取り込む",
    en: "Import existing mcpack/mcaddon/zip into a project workspace",
  },
  "command.validate.desc": {
    ja: "config・manifest の整合性をチェック",
    en: "Validate manifests, dependencies, and project structure",
  },
  "validate.loadConfigFailed": {
    ja: "設定の読み込みに失敗しました: {error}",
    en: "Failed to load config: {error}",
  },
  "validate.missingBehaviorManifest": {
    ja: "ビヘイビアマニフェストが見つかりません: {path}",
    en: "Missing behavior manifest at {path}",
  },
  "validate.missingResourceManifest": {
    ja: "リソースマニフェストが見つかりません: {path}",
    en: "Missing resource manifest at {path}",
  },
  "validate.parseBehaviorManifestFailed": {
    ja: "ビヘイビアマニフェストの解析に失敗しました: {error}",
    en: "Failed to parse behavior manifest: {error}",
  },
  "validate.parseResourceManifestFailed": {
    ja: "リソースマニフェストの解析に失敗しました: {error}",
    en: "Failed to parse resource manifest: {error}",
  },
  "validate.behaviorMissingResourceDep": {
    ja: "ビヘイビアマニフェストにリソースの依存関係がありません",
    en: "Behavior pack manifest missing dependency on resource pack",
  },
  "validate.resourceMissingBehaviorDep": {
    ja: "リソースマニフェストにビヘイビアの依存関係がありません",
    en: "Resource pack manifest missing dependency on behavior pack",
  },
  "validate.behaviorMissingScriptModule": {
    ja: "config.script があるのに script モジュールがありません",
    en: "Behavior pack missing script module while config.script is defined",
  },
  "validate.missingScriptDeps": {
    ja: "ビヘイビアマニフェストに script 依存がありません: {deps}",
    en: "Behavior manifest missing script dependencies: {deps}",
  },
  "validate.behaviorMissingMinEngine": {
    ja: "ビヘイビアマニフェストに min_engine_version がありません",
    en: "Behavior manifest missing min_engine_version",
  },
  "validate.behaviorMissingDescription": {
    ja: "ビヘイビアマニフェストに description がありません",
    en: "Behavior manifest missing description",
  },
  "validate.resourceMissingMinEngine": {
    ja: "リソースマニフェストに min_engine_version がありません",
    en: "Resource manifest missing min_engine_version",
  },
  "validate.resourceMissingDescription": {
    ja: "リソースマニフェストに description がありません",
    en: "Resource manifest missing description",
  },
  "validate.versionTuple": {
    ja: "{context} の version は 0 以上の整数3つである必要があります",
    en: "{context} version must be a tuple of three non-negative integers",
  },
  "validate.formatVersion": {
    ja: "{kind} マニフェストの format_version は 2 である必要があります",
    en: "{kind} manifest format_version should be 2",
  },
  "validate.headerUuidMissing": {
    ja: "{kind} マニフェストの header.uuid がありません",
    en: "{kind} manifest header.uuid is missing",
  },
  "validate.headerUuidDuplicate": {
    ja: "{kind} マニフェストの header.uuid が重複しています",
    en: "{kind} manifest header.uuid duplicates another UUID",
  },
  "validate.modulesMissing": {
    ja: "{kind} マニフェストの modules がありません",
    en: "{kind} manifest modules are missing",
  },
  "validate.moduleUuidMissing": {
    ja: "{kind} マニフェストの module に uuid がありません",
    en: "{kind} manifest module missing uuid",
  },
  "validate.moduleUuidDuplicate": {
    ja: "{kind} マニフェストの module uuid が重複しています",
    en: "{kind} manifest module uuid duplicates another UUID",
  },
  "validate.moduleTypeInvalid": {
    ja: "{kind} マニフェストの module type '{type}' は無効です",
    en: "{kind} manifest module type '{type}' is invalid",
  },
  "validate.context.header": {
    ja: "{kind} マニフェスト header",
    en: "{kind} manifest header",
  },
  "validate.context.minEngine": {
    ja: "{kind} マニフェスト header.min_engine_version",
    en: "{kind} manifest header.min_engine_version",
  },
  "validate.context.module": {
    ja: "{kind} マニフェスト module",
    en: "{kind} manifest module",
  },
  "validate.passed": {
    ja: "検証に成功しました。",
    en: "Validation passed.",
  },
  "validate.issues": {
    ja: "検証エラー:",
    en: "Validation issues:",
  },
  "command.build.desc": {
    ja: "core-build-tasks を使ってパックをビルド",
    en: "Build/compile packs using @minecraft/core-build-tasks",
  },
  "build.bundling": {
    ja: "スクリプトをバンドル: {entry} -> {out}",
    en: "Bundling script: {entry} -> {out}",
  },
  "build.outputNotDir": {
    ja: "ビルド出力がディレクトリではありません: {path}",
    en: "Build output is not a directory: {path}",
  },
  "build.completed": {
    ja: "ビルド完了 ({mode}) -> {outDir}",
    en: "Build completed ({mode}) -> {outDir}",
  },
  "build.bundleTaskMissing": {
    ja: "@minecraft/core-build-tasks に bundleTask が見つかりません",
    en: "bundleTask not found in @minecraft/core-build-tasks",
  },
  "build.eslintMissing": {
    ja: "eslint が見つかりません。npm install を実行してください。",
    en: "eslint not found in project. Run npm install.",
  },
  "build.eslintExit": {
    ja: "eslint が終了しました (code {code})",
    en: "eslint exited with code {code}",
  },
  "command.package.desc": {
    ja: "ビルド成果物を配布用アーカイブ（mcpack/mcaddon）に固める",
    en: "Package build artifacts into distributable archives (zip)",
  },
  "command.deps.desc": {
    ja: "Script API の npm 依存を同期・インストール",
    en: "Sync Script API npm dependencies into config/manifest",
  },
  "command.sync.desc": {
    ja: "ビルド成果物を開発フォルダへ同期",
    en: "Sync build outputs to local Minecraft developer folders",
  },
  "command.link.desc": {
    ja: "開発フォルダへシンボリックリンクを作成",
    en: "Create symlinks in Minecraft development folders",
  },
  "command.watch.desc": {
    ja: "複数プロジェクトを監視し、変更ごとに自動ビルド＋同期",
    en: "Watch projects, auto build (watch outDir) and sync on change",
  },
  "command.help.desc": {
    ja: "ヘルプを表示",
    en: "Show help",
  },
  "command.setting.desc": {
    ja: "CLI の設定を変更（言語など）",
    en: "Change CLI settings (language, etc.)",
  },
  "command.remove.desc": {
    ja: "プロジェクトを安全に削除",
    en: "Safely remove a project",
  },
  "remove.selectProject": {
    ja: "削除するプロジェクトを選択",
    en: "Select a project to remove",
  },
  "remove.confirmProject": {
    ja: "プロジェクト '{name}' を削除しますか？",
    en: "Remove project '{name}'?",
  },
  "remove.notFound": {
    ja: "指定されたプロジェクトが見つかりません: {name}",
    en: "Project not found: {name}",
  },
  "remove.none": {
    ja: "削除できるプロジェクトがありません。",
    en: "No removable projects found.",
  },
  "remove.done": {
    ja: "プロジェクト '{name}' を削除しました。",
    en: "Removed project '{name}'.",
  },
  "setting.selectItem": {
    ja: "変更する項目を選択",
    en: "Select a setting to change",
  },
  "setting.language": {
    ja: "表示言語",
    en: "Display language",
  },
  "setting.languageSaved": {
    ja: "言語設定を保存しました。",
    en: "Language setting saved.",
  },
  "setting.current": {
    ja: "現在の設定",
    en: "Current settings",
  },
  "setting.langDesc": {
    ja: "ja: 日本語, en: English",
    en: "ja: Japanese, en: English",
  },
  "setting.projectRoot": {
    ja: "プロジェクトの保存先",
    en: "Project root",
  },
  "setting.projectRootHint": {
    ja: "project root path",
    en: "project root path",
  },
  "setting.projectRootPrompt": {
    ja: "プロジェクトの保存先フォルダ",
    en: "Project root folder",
  },
  "setting.projectRootLine": {
    ja: "- projectRoot: {path}",
    en: "- projectRoot: {path}",
  },
  "setting.projectRootSaved": {
    ja: "現在の設定: projectRoot={path}",
    en: "Current settings: projectRoot={path}",
  },
  "setting.settingsPath": {
    ja: "settings: {path}",
    en: "settings: {path}",
  },
  "setting.unset": {
    ja: "(未設定)",
    en: "(unset)",
  },
  "update.available": {
    ja: "新しいバージョンが見つかりました: {current} → {latest}",
    en: "Update available: {current} → {latest}",
  },
  "update.choice": {
    ja: "アップデートしますか？",
    en: "Would you like to update?",
  },
  "update.now": {
    ja: "今すぐ更新",
    en: "Update now",
  },
  "update.later": {
    ja: "後で",
    en: "Later",
  },
  "update.skip": {
    ja: "このバージョンはスキップ",
    en: "Skip this version",
  },
  "update.running": {
    ja: "アップデート中...",
    en: "Updating...",
  },
  "update.done": {
    ja: "アップデート完了",
    en: "Update complete",
  },
  "update.failed": {
    ja: "アップデートに失敗しました",
    en: "Update failed",
  },
  "bump.selectType": {
    ja: "バージョン更新方法を選択",
    en: "Select bump type",
  },
  "bump.option.patch": {
    ja: "パッチ (+0.0.1)",
    en: "patch (+0.0.1)",
  },
  "bump.option.minor": {
    ja: "マイナー (+0.1.0)",
    en: "minor (+0.1.0)",
  },
  "bump.option.major": {
    ja: "メジャー (+1.0.0)",
    en: "major (+1.0.0)",
  },
  "bump.option.custom": {
    ja: "バージョンを直接指定",
    en: "set exact version",
  },
  "bump.enterVersion": {
    ja: "バージョンを入力 (x.y.z)",
    en: "Enter version (x.y.z)",
  },
  "bump.versionRequired": {
    ja: "バージョンは必須です",
    en: "Version is required",
  },
  "bump.updateMinEngine": {
    ja: "min_engine_version を更新しますか？",
    en: "Update min_engine_version?",
  },
  "bump.keepCurrent": {
    ja: "変更しない",
    en: "Keep current",
  },
  "bump.setMinEngine": {
    ja: "手動入力",
    en: "Set manually",
  },
  "bump.enterMinEngine": {
    ja: "min_engine_version を入力 (x.y.z)",
    en: "Enter min_engine_version (x.y.z)",
  },
  "bump.minEngineFormat": {
    ja: "形式は x.y.z で入力してください",
    en: "Format must be x.y.z",
  },
  "bump.doneSet": {
    ja: "バージョンを {version} に設定しました{minEngine}。",
    en: "Set version to {version}{minEngine}.",
  },
  "bump.doneBumped": {
    ja: "{level} を適用し {version} に更新しました{minEngine}。",
    en: "Bumped {level} to {version}{minEngine}.",
  },
  "bump.minEngineSuffix": {
    ja: " (min_engine_version={value})",
    en: " (min_engine_version={value})",
  },
  "onboarding.langPrompt": {
    ja: "表示言語を選択してください",
    en: "Select display language",
  },
  "onboarding.cancelled": {
    ja: "セットアップを中止しました。",
    en: "Setup cancelled.",
  },
  "onboarding.saved": {
    ja: "初期設定を保存しました。",
    en: "Initial settings saved.",
  },
  "onboarding.projectRootPrompt": {
    ja: "プロジェクトの保存先フォルダ（絶対パス）を入力してください",
    en: "Enter the project root folder (absolute path)",
  },
  "onboarding.projectRootInput": {
    ja: "プロジェクトの保存先フォルダ名",
    en: "Project root folder name",
  },
  "settings.setupTitle": {
    ja: "BedrockKit 初期設定",
    en: "BedrockKit setup",
  },
  "help.title": {
    ja: "BedrockKit CLI",
    en: "BedrockKit CLI",
  },
  "help.usage": {
    ja: "使い方:",
    en: "Usage:",
  },
  "help.usageCommand": {
    ja: "<command> [...args]",
    en: "<command> [...args]",
  },
  "help.usageInteractive": {
    ja: "-i|--interactive",
    en: "-i|--interactive",
  },
  "help.commands": {
    ja: "コマンド:",
    en: "Commands:",
  },
  "help.flags": {
    ja: "フラグ:",
    en: "Flags:",
  },
  "help.flag.help": {
    ja: "ヘルプを表示",
    en: "Show help",
  },
  "help.flag.version": {
    ja: "バージョンを表示",
    en: "Show version",
  },
  "help.flag.interactive": {
    ja: "対話式メニューを起動",
    en: "Launch arrow-key menu",
  },
  "help.flag.json": {
    ja: "機械可読の出力 (build/package/sync/validate)",
    en: "Machine-readable output (build/package/sync/validate)",
  },
  "help.flag.quiet": {
    ja: "エラー以外のログを抑制 (build/package/sync/validate)",
    en: "Suppress non-error logs (build/package/sync/validate)",
  },
  "help.flag.build": {
    ja: "sync/package の事前ビルドを無効化 (default: true)",
    en: "Skip pre-build for sync/package (default: true)",
  },
  "help.bkitignore": {
    ja: ".bkitignore:",
    en: ".bkitignore:",
  },
  "help.bkitignoreDesc": {
    ja: "* ワイルドカードと # コメントに対応します。",
    en: "Supports simple patterns with * wildcard and # comments.",
  },
  "help.bkitignoreExample": {
    ja: "例:",
    en: "Example:",
  },
  "ui.bannerTagline": {
    ja: "Minecraft Bedrock 向け TypeScript CLI",
    en: "TypeScript CLI for Minecraft Bedrock",
  },
};

export function t(key: string, lang: Lang = "ja", params: Record<string, string> = {}): string {
  const entry = dict[key];
  const base = entry ? entry[lang] ?? entry.ja ?? key : key;
  return Object.keys(params).reduce(
    (acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), params[k] ?? ""),
    base,
  );
}

export function resolveLang(input?: string | boolean, fallback?: Lang): Lang {
  const env = process.env.BKIT_LANG?.toLowerCase();
  const flag = typeof input === "string" ? input.toLowerCase() : undefined;
  const v = flag ?? env;
  if (v === "en") return "en";
  if (v === "ja") return "ja";
  if (fallback === "en") return "en";
  return fallback ?? "ja";
}
