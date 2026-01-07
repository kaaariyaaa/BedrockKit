# BedrockKit

Minecraft Bedrock Edition 向けのアドオン／リソースパック開発を一括で回すための CLI です。初期化・依存管理・ビルド・配布パッケージ作成・開発環境への同期までを `bkit` コマンドで扱えます。

[English version is here](./README.en.md)

## 動作要件
- **Node.js**: 20 以上
- **npm / git**: テンプレート取得や依存インストールに使用
- **OS**: Windows / macOS / Linux いずれでも利用可能。Sync でゲームの開発用フォルダへコピーする際は、対象環境に合わせた権限が必要です。

## インストール
GitHub からグローバルにインストールできます。

```bash
npm i -g @bedrockkit/cli
```

リポジトリをクローンして使う場合は次のとおりです。

```bash
git clone https://github.com/kaaariyaaa/BedrockKit.git
cd BedrockKit
npm install
npm run build
npm install -g .   # もしくは npm link でローカルリンク
```

開発中にソースから直接試す場合は `npm run dev -- <command>` で `src/cli.ts` を起動できます。

## クイックスタート
```bash
# プロジェクトを対話的に初期化（./project/<name> 以下に展開）
bkit init

# ビルドして dist/ に成果物を作成
bkit build

# ビルド成果物を開発用フォルダに同期
bkit sync

# 配布用 .mcpack/.mcaddon を作成
bkit package
```

## 生成される構成例
`bkit init` で作られる標準構成は次のとおりです。

```
project/<addon-name>/
├─ bkit.config.json        # bkit の設定
├─ .bkitignore             # ビルド/コピー時の除外設定
├─ packs/
│  ├─ behavior/            # ビヘイビアパック
│  │  ├─ manifest.json
│  │  └─ scripts/main.ts   # スクリプトエントリ（選択時）
│  └─ resource/            # リソースパック
│     └─ manifest.json
└─ dist/                   # build/package の出力先
```

`bkit.config.json` の最小例:

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

## 主なコマンド
- `bkit init` (`new`) : テンプレートからワークスペースを作成。スクリプト API のパッケージとバージョンも対話的に選択可能。ESLint ルールは有効/無効を対話選択でき、フラグ `--eslint-rules <csv>` / `--no-eslint` でも指定可能。
- `bkit import <mcpack|mcaddon|zip>` : 既存アーカイブを展開し、`bkit.config.json` を生成してワークスペース化。JS→TS 変換はオプション（`--convert-ts`）。自動変換は互換性リスクがあるため、必要な場合のみ利用を推奨します。
- `bkit build [--out-dir <dir>]` : ビヘイビア/リソースパックを `dist/` にコピー。スクリプトが TypeScript の場合は `@minecraft/core-build-tasks` でバンドルを実行。
- `bkit package [--out <name>]` : `dist/` 以下から `.mcpack`（両パック）、両方揃っていれば `.mcaddon` も作成。
- `bkit sync [--target <name>] [--build=false]` : ビルド成果物を `config.sync.targets` で指定した場所へコピー。`product` 指定で Minecraft 開発環境へデプロイ。
- `bkit link [create|remove|edit]` : 開発フォルダへシンボリックリンクを作成/解除/再作成。`--source dist|packs`、`--mode symlink|junction`、`--behavior/--resource` に対応。`dist` が無い場合は自動でビルド。
- `bkit deps` : 選択した Script API 依存を npm にインストールし、`bkit.config.json` と `manifest.json` を同期。
- `bkit bump [major|minor|patch] [--to <version>] [--min-engine <x.y.z>]` : プロジェクト/マニフェストのバージョンを更新（任意で min_engine_version も上書き）。
- `bkit validate [--strict] [--json]` : config / manifest の整合性チェック。
- `bkit template <list|add|pull|rm>` : テンプレートレジストリ(`.bkit/templates*.json`)の管理。`custom-git` で任意のリポジトリを登録可能。
- `bkit watch` : `./project/<name>` 配下を監視し、変更ごとにビルドと同期を自動実行。`link` モードは非スクリプトをリンク共有し、TS は JS にビルドして `scripts` だけコピー。
- `bkit setting [--lang <ja|en>] [--project-root <path>]` : CLI 設定を変更（言語/プロジェクト保存先）。フラグ未指定時は対話で選択。
- `bkit remove [--project <name>]` : プロジェクトフォルダを削除（`--yes` で確認スキップ）。リンク解除は `bkit link remove` を使用。
- `npm run build:local` / `npm run package:local` : 生成/インポートされた各プロジェクトには `tools/local-build.mjs` と `tools/local-package.mjs` を同梱。BedrockKit CLI がなくても、プロジェクト単体でビルド＆.mcpack/.mcaddon パッケージ化が可能です。

## 同期ターゲットの書き方
- **core-build-tasks 経由**（開発版 Minecraft へデプロイ）  
  `sync.targets.<name>.product` に `BedrockUWP | PreviewUWP | BedrockGDK | PreviewGDK` を指定し、`projectName` で開発フォルダ名を上書き可能。
- **パス指定コピー**  
  `sync.targets.<name>.behavior` / `resource` にそれぞれのコピー先パスを直接記載。`bkit sync --dry-run` で内容を確認できます。

## テンプレート運用
- 既定で `official-sample` が登録されています。`bkit template list` で確認可能です。
- 任意の Git リポジトリを `bkit template add <name> <git-url>` で登録し、`bkit init --template <name>` で利用できます。
- `.bkit/templates/<name>` にクローンされるため、社内リポジトリ等も扱えます（SSH キーは `BKIT_SSH_KEY` 環境変数で指定可能）。

## 便利なオプション
- **--config <path>**: 対象プロジェクトを指定。複数ある場合は対話選択も可能。
- **--json**: 機械可読な形式で出力。
- **-q | --quiet**: ログ出力を抑制。
- **--lang <ja|en>**: 表示言語を切り替え。デフォルトは日本語です。環境変数 `BKIT_LANG` もサポートしています。
- **--build=false**: 共通オプション。事前ビルドをスキップします。
- **.bkitignore**: ビルド／同期時に無視するパターンを記載。

## よくある流れ
1. `bkit init` で土台を作成（または `bkit import` で既存アドオンを取り込み）。
2. `bkit build` で成果物を作成し、`bkit validate` で整合性確認。
3. `bkit sync` でゲームの開発用フォルダに反映、`bkit watch` で自動同期しながら開発。
4. リリース時に `bkit bump` でバージョンを上げ、`bkit package` で配布用アーカイブを生成。
