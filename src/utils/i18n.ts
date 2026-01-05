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
  "package.runBuild": {
    ja: "パッケージング前にビルドを実行しますか？",
    en: "Run build before packaging?",
  },
  "package.cancelled": {
    ja: "パッケージングを中止しました。",
    en: "Packaging cancelled.",
  },
  "deps.selectPackages": {
    ja: "含める Script API パッケージを選択（スペースで切替）",
    en: "Select Script API packages to include (space to toggle)",
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
  "sync.runBuild": {
    ja: "同期前にビルドを実行しますか？",
    en: "Run build before sync?",
  },
  "sync.cancelled": {
    ja: "同期を中止しました。",
    en: "Sync cancelled.",
  },
  "sync.selectTarget": {
    ja: "同期先を選択",
    en: "Select sync target",
  },
  "watch.selectProjects": {
    ja: "監視するプロジェクトを選択",
    en: "Select projects to watch",
  },
  "watch.intro": {
    ja: "監視を開始します（変更で自動ビルド＋同期）",
    en: "Watching projects for changes (auto build + sync)",
  },
  "config.selectProject": {
    ja: "プロジェクトを選択",
    en: "Select project",
  },
  "template.commandPrompt": {
    ja: "テンプレートコマンドを選択",
    en: "Template command",
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
  "command.build.desc": {
    ja: "core-build-tasks を使ってパックをビルド",
    en: "Build/compile packs using @minecraft/core-build-tasks",
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
  "command.watch.desc": {
    ja: "複数プロジェクトを監視し、変更ごとに自動ビルド＋同期",
    en: "Watch projects, auto build (watch outDir) and sync on change",
  },
  "command.config.desc": {
    ja: "bkit 設定を確認・管理",
    en: "Manage and inspect bkit configuration",
  },
  "command.help.desc": {
    ja: "ヘルプを表示",
    en: "Show help",
  },
  "command.setting.desc": {
    ja: "CLI の設定を変更（言語など）",
    en: "Change CLI settings (language, etc.)",
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
