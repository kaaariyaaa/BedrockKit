# BedrockKit CLI

Minecraft Bedrock Edition のアドオン開発を効率化する CLI です。プロジェクト初期化からビルド・同期・パッケージ化・既存アーカイブの取り込みまでをカバーします。

## 必要環境
- Node.js 20 以降（LTS 推奨）
- Git（テンプレート取得に使用）
- 対応 OS: Windows / macOS（Linux はベストエフォート）

## セットアップ
```bash
npm install
npm run build
```

## 主なコマンド
- `init`  
  プロジェクト雛形を生成。Behavior/Resource 選択、Script API 依存選択＆バージョン指定、GDK を既定とした sync 設定、`.bkitignore` 自動生成。テンプレートは公式サンプル or 登録済み Git テンプレを選択。
- `build`  
  `@minecraft/core-build-tasks` でスクリプトをバンドルし、packs を出力（`.bkitignore` 適用）。`--out-dir`、`--json`、`--quiet` 対応。
- `package`  
  mcpack/mcaddon を生成。デフォルトで事前ビルド実行（`--build=false` でスキップ）。`--json`/`--quiet` 対応。
- `sync`  
  ビルド成果を開発フォルダへ同期。`sync.targets` で product 指定（BedrockGDK/UWP など）またはパス指定可。`--build-dir`/`--out-dir` で出力指定。`--json`/`--quiet` 対応。
- `watch`  
  複数プロジェクトを選択して監視し、変更検知で専用 outDir（既定 `.watch-dist`）にビルド→同期を自動実行。`--projects`/`--out-dir`/`--quiet` 対応。
- `deps`  
  Script API 依存の選択とバージョン指定を対話で行い、npm uninstall/install で package.json・node_modules・config・manifest を同期。
- `validate`  
  config/manifest の検証。UUID 重複、必須フィールド、モジュール型、依存漏れなどをチェック。`--json` 対応。
- `import`  
  `.mcpack/.mcaddon/.zip` を取り込み、packs 配置・`bkit.config.json`/`.bkitignore` 生成。manifest の依存を解決して `npm ci` 優先でインストール（`--skip-install` でスキップ、`--force` で上書き）。
- `template list/add/pull/rm`  
  テンプレートレジストリ管理。Git 形式の URL を登録すると `init` で選択可能。

## 設定と同期
- `bkit.config.json`（または bkit.config.ts/mjs/js）でパスや sync ターゲットを管理。`sync.targets` に `product: BedrockGDK/BedrockUWP/...` を指定すると core-build-tasks の copyTask で開発フォルダへ配備。
- `.bkitignore` は build 時のコピー除外リスト。`*`/`**` ワイルドカードと `#` コメントをサポート。

## よく使うフラグ
- `--config <path>` 設定ファイル指定
- `--json` 機械可読出力（build/package/sync/validate）
- `--quiet` ログ抑制
- `--build=false` sync/package で事前ビルドをスキップ
- `--out-dir` / `--build-dir` ビルド出力先上書き（watch/sync 用）

## 補足
- Script API の `@minecraft/math` / `@minecraft/vanilla-data` は manifest 依存に書かず、バンドル/インポートで扱います。
- import で存在しないバージョン指定があれば、npm レジストリのプレフィックス一致や最新バージョンにフォールバックして解決を試みます。
