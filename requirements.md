# BedrockKit CLI 要件定義

## 概要
- 目的: Minecraft Bedrock Edition の addon/resource pack 開発を CLI で効率化し、プロジェクト雛形作成・検証・ビルド・パッケージ化・配布までを一貫して扱えるようにする。
- 成果物: Node.js 製 CLI パッケージ (npm 配布)。コマンド名は仮に `bkit` を想定。

## ステークホルダー
- プライマリ: Bedrock addon/resource pack を日常的に開発する個人/小規模チームの開発者。
- セカンダリ: 配布担当、CI/CD 管理者、テンプレート作者。

## 前提・制約
- 対応 OS: Windows 10/11, macOS 13+ (ARM/Intel)。Linux はベストエフォート (将来対応可)。
- 対応 Node: LTS (20.x 時点)。`engines` に明記し、インストール時に警告を出す。
- ファイル操作は `path` API で OS 依存を排除。外部コマンド依存は最小化。
- Git で LF をデフォルト。PowerShell/Bash どちらでも動く npm scripts を採用。

## スコープ (MVP)
- プロジェクト初期化: ベースとなる addon/resource pack 構成を生成し、manifest.json とフォルダを作成。
- テンプレート管理: 公式サンプル、ツール提供テンプレート、ユーザー登録テンプレートから選択。ローカル/リモート (Git) から取得できる仕組みを想定。
- 複数 pack 管理: 1 プロジェクトで複数の addon/resource pack を管理し、共通設定を共有できる。
- 依存関係管理: addon と resource pack の相互依存を宣言し、manifest に反映。`@minecraft/server`, `@minecraft/server-ui`, `@minecraft/common`, `@minecraft/math` などの npm 依存も管理。
- UUID/バージョン管理: pack_uuid/module_uuid の生成、`semver` に基づくバージョンバンプ (`patch/minor/major`)。
- 検証: manifest.json や依存関係の静的検証。必須フィールド・重複 UUID・互換性のチェック。
- ビルド/コンパイル: `@minecraft/core-build-tasks` を利用し、addon/resource pack をコンパイルして出力。リソースとビヘイビアの同期構成をサポート。
- ビルド/パッケージ: 開発用フォルダから配布用パッケージを生成 (zip)。
- dev 環境との同期: コンパイル/ビルド成果物をローカルの Minecraft UWP (Windows) あるいは macOS 版 (教育版等) の開発者フォルダへコピー/同期するコマンドを用意 (対象パスは設定で指定)。
- 設定管理: プロジェクトルートに設定ファイル (例: `bkit.config.{json,ts}`) を置き、パスやテンプレート、ビルド出力先を管理。
- ログ/出力: 進行状況をインフォ/警告/エラーで整形表示。`--json` で機械可読出力も提供。
- インタラクティブ/非インタラクティブ: 対話プロンプトをデフォルトにしつつ、全オプションをフラグ指定で自動化可能にする。

## 想定ユースケース
- `bkit init`: 新規 addon/resource pack の雛形作成。
- `bkit bump patch` & `bkit build`: バージョン更新と配布用 zip 生成。
- `bkit validate`: manifest や依存関係の整合性チェックを CI で実行。
- `bkit sync --target dev`: 開発環境フォルダへコピーし、すぐにゲーム内で確認。
- `bkit template add <name> <git-url>`: 社内テンプレートの登録。

## 機能要件 (詳細)
- **コマンド体系**: `init/new`, `template list/add/rm`, `bump`, `validate`, `build`, `package`, `sync`, `config`, `help`。サブコマンド設計を明文化。
- **テンプレート**: 公式/ツール提供/ユーザー登録テンプレのメタ情報 (名前、説明、対応バージョン、取得元) を管理。バージョン固定やハッシュ検証で再現性を確保。
- **マルチ pack 管理**: 複数の addon/resource pack を単一ワークスペースで扱い、共通設定と個別設定を併用できる。
- **依存関係リンク**: resource/behavior pack の相互依存を設定ファイルで宣言し、manifest に書き戻すユーティリティ。`@minecraft/server`, `@minecraft/server-ui`, `@minecraft/common`, `@minecraft/math` などの npm 依存を lockfile で固定。
- **manifest 生成/更新**: `header` と `modules` を型定義でバリデート。`min_engine_version` 等の推奨値を提示。
- **バージョン/UUID 管理**: UUID の生成と衝突チェック。`bkit bump` で manifest と設定ファイルを一括更新。
- **ビルド/コンパイル**: `@minecraft/core-build-tasks` を用いてビルド/コンパイルを実行。ビルドターゲットと出力を設定ファイルで切り替え可能に。
- **ビルド/パッケージ**: 出力先指定 (`dist/` デフォルト)。圧縮/コピーの除外パターン設定 (例: `.bkitignore`)。
- **同期**: Minecraft 開発フォルダへのコピー。パスは OS ごとに設定項目を分離。ドライラン (`--dry-run`) を用意。
- **検証**: JSON スキーマ検証、ファイル存在チェック、警告とエラーの分類。`--strict` でより厳格に。
- **設定**: ルート/ユーザーごとの設定階層 (プロジェクト > ユーザー > デフォルト)。環境変数による上書きも許可。
- **拡張性**: 将来的なプラグイン/フック (前後処理) を見据え、内部 API を分離しておく。
- **出力**: カラー/非カラー、JSON 出力スキーマの固定、`--quiet`/`--verbose` を提供。
- **リリース自動化**: GitHub Actions で `validate`/`build`/`package` を実行し、タグ/リリース作成とアーティファクト添付を自動化。

## 設計・実装方針 (参考)
- **コマンドディスパッチ**: `COMMANDS` 配列にサブコマンドツリーを定義し、単純なディスパッチで CLI を構成する (interactive/non-interactive 共通)。
- **テンプレートバンドル**: `init` で配布用テンプレート/同梱ファイルをパッケージに含め、コピーするだけで雛形が作れる構成にする。
- **UI**: `@clack/prompts` のようなプロンプトで対話セットアップを行いつつ、同一コマンドをフラグ指定で非対話実行できるよう設計する。

## 非機能要件
- **再現性**: Node LTS での動作保証。依存パッケージは lockfile で固定。
- **パフォーマンス**: 小〜中規模プロジェクトで 1〜2 秒以内のバリデーションと 3〜5 秒以内のビルドを目標。
- **信頼性**: 検証失敗時は非 0 終了コード。例外はキャッチしてユーザに意味のあるメッセージを返す。
- **クロスプラットフォーム**: パス/改行差異を考慮し、OS 依存 API を抽象化。Windows/macOS で同一 CLI オプションが動作。
- **ロギング**: 標準出力/標準エラーの使い分け。デバッグログは `DEBUG=bkit:*` 環境変数で有効化可能に。
- **設定ファイル形式**: JSON/TS (esm) の双方を許容。将来互換性のためスキーマを公開。
- **セキュリティ**: 外部テンプレート取得時のハッシュ検証をオプションでサポート。不要な権限のファイル生成を避ける。

## テスト/品質
- 単体テスト: バリデーション・テンプレート生成・UUID/バージョン処理のロジックをカバー。
- E2E テスト: `init` → `build` → `validate` の一連フローを一時ディレクトリで検証。
- クロスプラットフォーム CI: GitHub Actions の matrix (windows-latest/macOS-latest) + Node LTS で実行。

## 配布・バージョニング
- npm で配布し、`npx bkit` での一時実行をサポート。グローバルインストールはオプション。
- `engines`/`bin` を package.json に設定。`npm create bkit` のテンプレート配布も将来検討。
- CLI 自身のセマンティックバージョニングを採用し、CHANGELOG を維持。

## 成功指標 (初期)
- `init`→`build`→`sync` が Windows/macOS 双方で手順書なしに動作すること。
- `validate` の検知精度: 代表的な manifest の欠損/型不一致/UUID 重複を検出可能。
- 代表的なテンプレートで 5 分以内に開発開始できること。

## オープンクエスチョン
- Minecraft 開発フォルダの OS ごとの既定パスをどこまで自動検出するか、ユーザー入力に頼るか。
- テンプレートの配布形態 (Git 直参照 vs パッケージ内蔵) をどうするか。
- バリデーションの厳格度をどこまで上げるか (公式仕様との差分許容範囲)。
- プラグイン/フック API を MVP で用意するか、後続にするか。
