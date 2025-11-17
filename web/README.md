# 仕入管理システム

取引先から送られてくる様々な形式の納品書・請求書を自動解析し、仕入状況をリアルタイムで管理するWebシステム。

## 🎯 主な機能

### 📊 ダッシュボード
- 今月の仕入総額
- 未処理件数・未消込件数
- 仕入先別集計（棒グラフ・円グラフ）
- 部門別仕入金額（Smaregi連携）
- 直近アップロード一覧

### 📤 ファイルアップロード・解析
- **対応形式**: PDF、Excel (.xlsx, .xls)、CSV
- **AI解析**: Google Gemini APIによるPDF自動解析
- **テンプレートマッピング**: 仕入先ごとのExcel/CSVカラムマッピング
- **プレビュー・編集**: 解析結果の確認と手動修正

### 📋 納品データ管理
- 納品書一覧表示
- 検索・フィルタ（期間、仕入先、ステータス、キーワード）
- 詳細表示（サイドパネル）
- CSV/Excelエクスポート
- 商品コード別入荷履歴検索

### 👥 仕入先管理
- 仕入先の登録・編集・削除
- 検索・フィルタ（アクティブ/非アクティブ）
- ファイル形式テンプレート管理

### 📁 Google Drive連携（任意）
- 監視フォルダの自動ポーリング（5分間隔）
- ファイル自動取り込み
- 保留BOX機能（仕入先未確定ファイルの管理）

### 🛍️ Smaregi連携（任意）
- 部門・商品マスタ自動同期（1時間間隔）
- 部門別仕入金額集計
- 商品コードによる自動紐付け

---

## 🏗️ 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS 4
- **データベース**: Supabase (PostgreSQL)
- **外部API**: Google Gemini API, Google Drive API, Smaregi API
- **デプロイ**: Vercel
- **その他**: React Hook Form, Zustand, Recharts, Sonner

---

## 🚀 セットアップ

### 1. 環境変数の設定

`web/.env.local` を作成し、以下の環境変数を設定:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Google Drive連携（任意）
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_WATCH_FOLDER_ID=your_drive_folder_id

# Smaregi連携（任意）
SMAREGI_CONTRACT_ID=your_contract_id
SMAREGI_CLIENT_ID=your_client_id
SMAREGI_CLIENT_SECRET=your_client_secret
SMAREGI_SYNC_SECRET=your_sync_secret

# その他
NEXT_PUBLIC_MAX_UPLOAD_MB=10
```

詳細は `docs/vercel_env_setup.md` を参照。

### 2. データベースのセットアップ

Supabaseで以下のマイグレーションを順番に実行:

```sql
-- 1. 基本テーブル
docs/migration_create_suppliers.sql
docs/migration_create_delivery_tables.sql

-- 2. 拡張機能
docs/migration_create_file_format_templates.sql
docs/migration_add_delivery_date_to_items.sql
docs/migration_add_delivery_note_number_to_items.sql

-- 3. 外部連携（任意）
docs/migration_create_drive_tables.sql
docs/migration_create_smaregi_tables.sql
```

詳細は `docs/database_schema.md` を参照。

### 3. 依存関係のインストール

```bash
cd web
npm install
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

---

## 📦 本番環境へのデプロイ

### Vercelへのデプロイ

1. GitHubリポジトリをVercelに接続
2. プロジェクト設定:
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
3. 環境変数を設定（Settings → Environment Variables）
4. デプロイ実行

### Vercel Cron設定（自動実行）

`web/vercel.json` で自動実行を設定済み:

- **Google Driveポーリング**: 5分ごと
- **Smaregi同期**: 1時間ごと

詳細は `docs/vercel_cron_setup.md` を参照。

**注意**: Vercel Cronは **Proプラン（$20/月）** が必要です。

---

## 📁 プロジェクト構造

```
purchase-management/
├── web/                          # Next.jsアプリケーション
│   ├── src/
│   │   ├── app/                  # App Router
│   │   │   ├── page.tsx          # ダッシュボード
│   │   │   ├── upload/           # アップロード
│   │   │   ├── data/             # 納品データ一覧
│   │   │   ├── suppliers/        # 仕入先管理
│   │   │   ├── drive-imports/    # Drive保留BOX
│   │   │   └── api/              # APIルート
│   │   ├── components/           # Reactコンポーネント
│   │   ├── lib/                  # ライブラリ・ユーティリティ
│   │   ├── types/                # TypeScript型定義
│   │   └── store/                # Zustand状態管理
│   ├── vercel.json               # Vercel Cron設定
│   └── package.json
├── docs/                         # ドキュメント
│   ├── database_schema.md        # データベーススキーマ
│   ├── vercel_cron_setup.md      # Cron設定ガイド
│   ├── vercel_env_setup.md       # 環境変数設定
│   ├── google_drive_auto_import.md
│   ├── smaregi_setup.md
│   └── migration_*.sql           # マイグレーションファイル
└── test-files/                   # テスト用ファイル
```

---

## 🔧 開発ガイド

### コード品質

```bash
# Lint
npm run lint

# ビルドチェック
npm run build
```

### APIエンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/dashboard/stats` | GET | ダッシュボード統計 |
| `/api/delivery-notes` | GET, POST | 納品書CRUD |
| `/api/delivery-notes/items` | GET | 商品コード検索 |
| `/api/suppliers` | GET, POST | 仕入先CRUD |
| `/api/uploads` | POST | ファイルアップロード |
| `/api/drive/poll` | POST | Drive自動ポーリング（Cron） |
| `/api/smaregi/sync` | POST | Smaregi同期（Cron） |

詳細は各ルートファイルのコメントを参照。

---

## 📚 ドキュメント

- [データベーススキーマ](../docs/database_schema.md)
- [Vercel Cron設定](../docs/vercel_cron_setup.md)
- [環境変数設定](../docs/vercel_env_setup.md)
- [Google Drive連携](../docs/google_drive_auto_import.md)
- [Smaregi連携](../docs/smaregi_setup.md)

---

## 🐛 トラブルシューティング

### ファイルアップロードが失敗する

1. ファイルサイズが10MB以下か確認
2. Gemini APIキーが正しく設定されているか確認
3. ブラウザのコンソールログを確認

### Google Drive連携が動作しない

1. サービスアカウントの設定を確認
2. 監視フォルダIDが正しいか確認
3. 環境変数 `GOOGLE_PRIVATE_KEY` の改行文字が正しいか確認

### Smaregi同期が失敗する

1. 契約ID、クライアントID、シークレットを確認
2. Smaregi APIのアクセス権限を確認
3. `/api/smaregi/sync` を手動で実行してエラーログを確認

---

## 📄 ライセンス

このプロジェクトは私的利用のために開発されています。

---

## 🙏 サポート

問題が発生した場合:

1. ドキュメントを確認
2. ブラウザのコンソールログを確認
3. Vercelのデプロイログを確認
4. Supabaseのログを確認

---

**最終更新日:** 2025-11-17
