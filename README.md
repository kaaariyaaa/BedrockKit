# BedrockKit

Minecraft Bedrock Edition 向けのアドオン／リソースパック開発を一括で回すための CLI です。初期化・依存管理・ビルド・配布パッケージ作成・開発環境への同期までを `bkit` コマンドで扱えます。

## 動作要件
- Node.js 20 以上
- npm / git（テンプレート取得や依存インストールに使用）
- Windows / macOS / Linux いずれでも利用可能。Sync でゲームの開発用フォルダへコピーする際は、対象環境に合わせた権限が必要です。

## インストール
リポジトリを取得後、依存を入れてグローバルにリンクします。

```bash
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
- `bkit init` (`new`) – テンプレートからワークスペースを作成。スクリプト API のパッケージとバージョンも対話的に選択可能。
- `bkit import <mcpack|mcaddon|zip>` – 既存アーカイブを展開し、`bkit.config.json` を生成してワークスペース化。JS→TS 変換はオプション（`--convert-ts` / `--no-convert-ts`、未指定時は対話確認）。自動変換は互換性リスクがあるため、必要な場合のみ利用推奨。
- `bkit build [--out-dir <dir>]` – ビヘイビア/リソースパックを `dist/` にコピー。スクリプトエントリが TypeScript の場合は `@minecraft/core-build-tasks` でバンドル。
- `bkit package [--out <name>]` – `dist/` 以下から `.mcpack`（両パック）、両方揃っていれば `.mcaddon` も作成。必要に応じて事前に build を実行。
- `bkit sync [--target <name>] [--build=false]` – ビルド成果物を `config.sync.targets` で指定した場所へコピー。`product` を指定すると core-build-tasks の `copyTask` で MC 開発環境へデプロイ。
- `bkit deps` – 選択した Script API 依存を npm にインストールし、`bkit.config.json` と `packs/behavior/manifest.json` を同期。
- `bkit bump [major|minor|patch]` – プロジェクト/マニフェストのバージョンを一括更新。
- `bkit validate [--strict] [--json]` – config と manifest の整合性チェック。
- `bkit template <list|add|pull|rm>` – テンプレートレジストリ(`.bkit/templates*.json`)の管理。`custom-git` で任意リポジトリを登録可能。
- `bkit watch` – `./project/<name>` 配下を監視し、変更ごとに `build --out-dir .watch-dist` → `sync --build=false --build-dir .watch-dist` を実行。
- `bkit config [--path <file>] [--json]` – 読み込んだ設定を確認。

## 同期ターゲットの書き方
- **core-build-tasks 経由**（開発版 Minecraft へデプロイ）  
  `sync.targets.<name>.product` に `BedrockUWP | PreviewUWP | BedrockGDK | PreviewGDK` を指定し、`projectName` で開発フォルダ名を上書き可能。
- **パス指定コピー**  
  `sync.targets.<name>.behavior` / `resource` にそれぞれのコピー先パスを記載。`bkit sync --dry-run` でコピー内容だけ確認できます。

## テンプレート運用
- 既定で `official-sample` が登録されています。`bkit template list` で確認できます。
- 任意の Git リポジトリを `bkit template add <name> <git-url>` で登録し、`bkit init --template <name>` で利用できます。
- `.bkit/templates/<name>` にクローンされるため、社内リポジトリ等も扱えます（SSH キーは `BKIT_SSH_KEY` 環境変数で指定可能）。

## 便利なオプション
- どのコマンドでも `--config <path>` で対象プロジェクトを指定（複数プロジェクトがある場合は対話選択にも対応）。
- 機械可読出力が欲しい場合は `--json`、静かに動かす場合は `-q | --quiet`。
- `build`/`sync`/`package` 共通で `--build=false` を渡すと事前ビルドをスキップ。
- `.bkitignore` に記載したパターンはビルド／同期時に無視されます。

## よくある流れ
1. `bkit init` で土台を作成（または `bkit import` で既存アドオンを取り込み）。
2. `bkit build` で成果物を作成し、`bkit validate` で整合性確認。
3. `bkit sync` でゲームの開発用フォルダに反映、`bkit watch` で自動同期しながら開発。
4. リリース時に `bkit bump` でバージョンを上げ、`bkit package` で配布用アーカイブを生成。
