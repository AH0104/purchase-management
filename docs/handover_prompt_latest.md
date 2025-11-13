# 仕入支払管理システム - 完全引き継ぎプロンプト（最新版）

## 🎯 プロジェクト概要

取引先から送られてくる様々な形式（Excel、PDF、CSV）の納品書・請求書を、AIで自動解析してデータベースに登録し、仕入状況をリアルタイムで管理するWebシステム。

### 対象ユーザー
- 社内スタッフ3名（非エンジニア）
- 取引先数：約50社
- 月間処理量：約10,000行のデータ

---

## ✅ 実装完了機能（2025年1月時点）

### 1. プロジェクトセットアップ
- Next.js 16 + TypeScript + Tailwind CSS でプロジェクト構築
- Supabase 接続設定完了
- Google Gemini API 接続設定完了
- 必要な依存関係インストール済み

### 2. UI実装
- **レイアウト**: freee/スマレジ風のサイドナビゲーション（左側固定サイドバー）
- **主要ページ**:
  - ダッシュボード（`/`）✅ 実装完了
  - 納品データ一覧（`/data`）✅ 実装完了
  - ファイルアップロード（`/upload`）✅ 実装完了
  - 仕入先管理（`/suppliers`）✅ 実装完了
  - 分析（`/analysis` - 将来拡張用）

### 3. ダッシュボード機能 ✅ 実装完了
- 今月の仕入総額表示
- 未処理件数表示
- 仕入先別集計グラフ（棒グラフ・円グラフ、recharts使用）
- 直近のアップロード一覧（最新10件）
- ファイルアップロードへのクイックアクセスボタン

### 4. 納品データ一覧機能 ✅ 実装完了
- 期間フィルタ（開始日・終了日）
- 仕入先フィルタ
- ステータスフィルタ（未処理・消込済・支払済）
- キーワード検索（ファイル名・伝票番号）
- 詳細表示（サイドパネル、明細含む）
- CSV/Excel エクスポート機能

### 5. 仕入先管理機能 ✅ 実装完了
- 仕入先一覧表示（Supabaseから取得）
- 新規登録（ドロワーフォーム）
- 編集・削除機能（納品書が存在する場合は論理削除）
- 検索・フィルタ機能（名称・コード検索、アクティブ/非アクティブ）
- ファイル形式テンプレート管理機能 ✅ 新規実装

### 6. ファイルアップロード & 解析機能 ✅ 実装完了
- **対応形式**: PDF、Excel (.xlsx, .xls)、CSV
- **PDF解析**: Google Gemini API (gemini-2.5-flash) を使用
- **Excel/CSV解析**: xlsx、papaparse ライブラリを使用
- **4ステップフロー**:
  1. ファイル選択（仕入先選択 + ファイルアップロード）
  2. マッピング設定（テンプレートがない場合のみ）✅ 新規実装
  3. データ確認・編集（ヘッダー情報 + 明細テーブル）
  4. 保存完了

### 7. ファイル形式マッピング機能 ✅ 新規実装（2025年1月）
- **目的**: 仕入先ごとに異なるファイルフォーマットに対応
- **機能**:
  - 手動マッピング設定UI（`ColumnMappingDialog`）
  - テンプレート保存機能（仕入先・ファイル形式ごと）
  - 自動テンプレート適用（保存済みテンプレートがある場合）
  - テンプレート管理（仕入先管理画面から確認・削除）
- **データベース**: `file_format_templates` テーブル
- **実装ファイル**:
  - `web/src/components/ColumnMappingDialog.tsx`
  - `web/src/types/file-format.ts`
  - `web/src/app/api/file-formats/templates/route.ts`
  - `web/src/app/api/file-formats/templates/[id]/route.ts`
  - `web/src/lib/parsers/excel.ts`（テンプレート対応）
  - `web/src/lib/parsers/csv.ts`（テンプレート対応）

---

## 🔧 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **フォーム管理**: React Hook Form
- **バリデーション**: Zod
- **データベース**: Supabase (PostgreSQL)
- **AI OCR**: Google Gemini API (gemini-2.5-flash)
- **ファイル解析**: xlsx, papaparse
- **グラフ**: recharts
- **通知**: sonner

---

## 📁 重要なファイル構成

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 共通レイアウト（サイドナビ）
│   │   ├── page.tsx                      # ダッシュボード ✅
│   │   ├── upload/page.tsx               # アップロード画面 ✅
│   │   ├── data/page.tsx                 # 納品データ一覧 ✅
│   │   ├── suppliers/page.tsx            # 仕入先管理 ✅
│   │   ├── analysis/page.tsx             # 分析（将来拡張用）
│   │   └── api/
│   │       ├── uploads/route.ts          # ファイル解析API
│   │       ├── delivery-notes/
│   │       │   ├── route.ts              # 納品書一覧・保存API ✅
│   │       │   └── [id]/route.ts         # 納品書詳細取得API ✅
│   │       ├── dashboard/stats/route.ts  # ダッシュボード統計API ✅
│   │       ├── suppliers/
│   │       │   ├── route.ts              # 仕入先一覧・登録API ✅
│   │       │   └── [id]/route.ts         # 仕入先詳細・更新・削除API ✅
│   │       └── file-formats/templates/   # テンプレート管理API ✅
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   ├── components/
│   │   ├── AppProviders.tsx              # プロバイダー（Toaster等）
│   │   └── ColumnMappingDialog.tsx       # マッピング設定UI ✅
│   ├── lib/
│   │   ├── supabaseClient.ts            # Supabase クライアント
│   │   ├── gemini.ts                    # Gemini API クライアント
│   │   ├── suppliers.ts                 # 仕入先取得関数
│   │   ├── upload/client.ts             # アップロードクライアント
│   │   ├── parsers/
│   │   │   ├── pdf.ts                   # PDF解析（Gemini使用）
│   │   │   ├── excel.ts                 # Excel解析（テンプレート対応）✅
│   │   │   ├── csv.ts                   # CSV解析（テンプレート対応）✅
│   │   │   └── utils.ts                 # 共通ユーティリティ（マッピング関数追加）✅
│   │   └── validators/
│   │       └── delivery.ts              # Zod スキーマ
│   ├── types/
│   │   ├── delivery.ts                  # 納品書関連の型定義
│   │   ├── supplier.ts                  # 仕入先関連の型定義
│   │   └── file-format.ts               # ファイル形式関連の型定義 ✅
│   └── store/
│       └── uploadStore.ts               # アップロード状態管理（ステップ1.5追加）✅
├── .env.local                            # 環境変数（要設定）
├── env.sample.txt                        # 環境変数サンプル
└── package.json
```

---

## 🗄️ データベーススキーマ

### 既存テーブル

#### `suppliers`（仕入先マスタ）
- `id` (BIGSERIAL PRIMARY KEY)
- `supplier_code` (VARCHAR)
- `supplier_name` (VARCHAR)
- `payment_terms` (INTEGER, nullable)
- `is_active` (BOOLEAN)
- `contact_person` (VARCHAR, nullable)
- `contact_email` (VARCHAR, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `delivery_notes`（納品書ヘッダー）
- `id` (BIGSERIAL PRIMARY KEY)
- `supplier_id` (INTEGER, FK → suppliers.id)
- `delivery_date` (DATE)
- `delivery_note_number` (VARCHAR, nullable)
- `total_amount` (NUMERIC)
- `tax_amount` (NUMERIC)
- `status` (VARCHAR: 'pending' | 'reconciled' | 'paid')
- `payment_due_date` (DATE, nullable)
- `original_file_name` (VARCHAR)
- `file_type` (VARCHAR)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `delivery_note_items`（納品書明細）
- `id` (BIGSERIAL PRIMARY KEY)
- `delivery_note_id` (INTEGER, FK → delivery_notes.id)
- `line_number` (INTEGER)
- `delivery_note_number` (VARCHAR, nullable) ✅ マイグレーション追加
- `product_code` (VARCHAR)
- `product_name` (VARCHAR)
- `quantity` (NUMERIC)
- `unit` (VARCHAR)
- `unit_price` (NUMERIC)
- `amount` (NUMERIC)
- `tax_rate` (NUMERIC)
- `tax_amount` (NUMERIC, nullable)
- `remarks` (VARCHAR, nullable)

### 新規テーブル ✅

#### `file_format_templates`（ファイル形式マッピングテンプレート）
- `id` (BIGSERIAL PRIMARY KEY)
- `supplier_id` (INTEGER, FK → suppliers.id, ON DELETE CASCADE)
- `file_type` (VARCHAR(10), CHECK: 'excel' | 'csv')
- `column_mapping` (JSONB) - カラムマッピング設定
- `header_row_index` (INTEGER, DEFAULT 0)
- `data_start_row_index` (INTEGER, DEFAULT 1)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- UNIQUE(supplier_id, file_type)

**マイグレーション**: `docs/migration_create_file_format_templates.sql` を実行済み ✅

---

## 📋 現在の状態

### 動作確認済み機能
- ✅ PDF ファイルのアップロードと Gemini による解析
- ✅ Excel/CSV ファイルのアップロードと解析
- ✅ 納品書番号の抽出（明細行ごと）
- ✅ 明細データの抽出と表示
- ✅ データの編集機能
- ✅ データベースへの保存
- ✅ ダッシュボード統計情報の表示
- ✅ 納品データ一覧のフィルタ・検索・エクスポート
- ✅ 仕入先管理（CRUD操作）
- ✅ ファイル形式マッピング設定・テンプレート保存 ✅

### 実装済み機能
- ファイルアップロード（進捗表示付き）
- PDF/Excel/CSV の自動解析
- ファイル形式マッピング設定UI ✅
- テンプレート自動適用 ✅
- データプレビューとインライン編集
- バリデーション（Zod）
- エラーハンドリング
- トースト通知（sonner）
- ダッシュボード統計表示 ✅
- 納品データ一覧・詳細表示 ✅
- 仕入先管理（CRUD）✅

---

## 🔄 ファイル形式マッピング機能の詳細

### 動作フロー

1. **ファイルアップロード時**:
   - 仕入先とファイル形式（Excel/CSV）でテンプレートを検索
   - テンプレートがある場合: 自動適用して解析
   - テンプレートがない場合: 自動検出を試行
   - 自動検出が失敗（明細が0件、または警告あり）: マッピング設定UIを表示

2. **マッピング設定UI**:
   - ヘッダー行の選択（Excel用）
   - 各システム項目をファイルのカラムにマッピング
   - データプレビュー（最初の3行）
   - テンプレートとして保存するか選択

3. **テンプレート保存後**:
   - 次回以降、同じ仕入先・同じファイル形式で自動適用

### マッピング設定の構造

```typescript
{
  product_code: { column: "A", header_name: "商品コード" },
  product_name: { column: "B", header_name: "商品名" },
  quantity: { column: "C", header_name: "数量" },
  unit_price: { column: "D", header_name: "単価" },
  amount: { column: "E", header_name: "金額" },
  delivery_note_number: { column: "F", header_name: "納品書番号" },
  remarks: { column: "G", header_name: "備考" }
}
```

- Excel: `column` は "A", "B", "C" などの列名
- CSV: `column` はヘッダー名（カラム名）

### 文字化け対策 ✅
- CSVファイル: UTF-8エンコーディングを明示的に指定、BOM除去
- 表示部分: `safeString`関数で文字列を安全に処理

---

## ⚙️ 環境変数設定

`.env.local` ファイルに以下を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://bbmurljkyinqqpvqzryx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=（設定済み）
GEMINI_API_KEY=（設定済み）
NEXT_PUBLIC_MAX_UPLOAD_MB=10
```

---

## 📝 重要な注意事項

1. **データベーススキーマ**: 既存のスキーマを使用。変更が必要な場合は `docs/migration_*.sql` に記録。

2. **納品書番号**: ヘッダーではなく明細行ごとに保存（複数の納品書番号が混在するケースに対応）。

3. **金額**: 税抜き金額のみを扱う（消費税・税込み金額は不要）。

4. **UI設計**: freee/スマレジ風のサイドナビゲーション。ユーザビリティを最優先。

5. **パフォーマンス**: ファイルアップロードやOCR解析の処理速度を重視。

6. **ファイル形式マッピング**: 仕入先ごとに異なるフォーマットに対応するため、テンプレート機能を活用。

---

## 🔍 トラブルシューティング

### PDF解析で明細が抽出されない場合
- Gemini のプロンプトを確認（`src/lib/parsers/pdf.ts`）
- ログで実際の応答内容を確認
- 必要に応じてプロンプトを調整

### 納品書番号が表示されない場合
- `delivery_note_items` テーブルに `delivery_note_number` カラムが存在するか確認
- マイグレーション SQL を実行済みか確認

### バリデーションエラー
- Zod スキーマ（`src/lib/validators/delivery.ts`）を確認
- `null` と `undefined` の扱いに注意

### マッピング設定UIが表示されない場合
- テンプレートが存在するか確認（仕入先管理画面から確認可能）
- 自動検出が成功している場合は表示されない（正常動作）
- 明細が0件、または警告がある場合のみ表示

### 文字化けが発生する場合
- CSVファイルがUTF-8で保存されているか確認
- Excelファイルの文字エンコーディングを確認
- `safeString`関数で処理されているか確認

### テンプレートが適用されない場合
- `file_format_templates` テーブルが作成されているか確認
- マイグレーション SQL を実行済みか確認
- APIエンドポイント `/api/file-formats/templates` が正常に動作しているか確認

---

## 🚀 今後のタスク

### 優先度：高

1. **分析機能の実装** (`/analysis`)
   - 月次トレンドグラフ
   - 仕入先別分析
   - 商品別分析
   - 期間比較機能

2. **支払管理機能**
   - 支払ステータス管理（pending → reconciled → paid）
   - 支払予定日の自動計算（支払条件から）
   - 支払実績登録
   - 支払一覧・支払履歴

3. **承認ワークフロー**
   - 承認フロー（登録 → 承認待ち → 承認済み）
   - 承認者管理
   - 承認通知

### 優先度：中

4. **データベースクエリ最適化**
   - 集計クエリの最適化
   - インデックスの確認・追加
   - パフォーマンステスト

5. **エラーハンドリングの強化**
   - より詳細なエラーメッセージ
   - リトライ機能
   - エラーログの記録

6. **パフォーマンス最適化**
   - 大きなファイルの処理
   - リスト表示の仮想化（必要に応じて）
   - キャッシュ戦略

### 優先度：低

7. **その他の機能**
   - アラート・通知機能（支払期限前アラート等）
   - レポート機能（カスタムレポート、定期レポート）
   - バッチ処理（一括ステータス更新等）
   - 操作ログ
   - 権限管理（ユーザー管理、ロール管理）

---

## 📚 参考ドキュメント

- `docs/mockup.md`: UIモックアップ
- `docs/upload_plan.md`: アップロード機能の設計
- `docs/migration_add_delivery_note_number_to_items.sql`: 納品書番号カラム追加マイグレーション
- `docs/migration_create_file_format_templates.sql`: ファイル形式テンプレートテーブル作成マイグレーション ✅

---

## 💡 開発の進め方

1. **段階的な実装**: 一度にすべてを作らず、機能ごとに動作確認
2. **ユーザビリティ優先**: 非エンジニアが使うため、直感的な操作性を重視
3. **エラーメッセージ**: 日本語でわかりやすく表示
4. **パフォーマンス**: 処理速度を重視（特にファイルアップロードとOCR解析）
5. **テンプレート活用**: 仕入先ごとのフォーマット差異はテンプレートで対応

---

## 🎯 現在の状態（2025年1月）

**実装完了**: 
- ダッシュボード機能 ✅
- 納品データ一覧機能 ✅
- 仕入先管理機能 ✅
- ファイル形式マッピング機能 ✅

**次のステップ**: 
- 分析機能の実装
- 支払管理機能の実装
- 承認ワークフローの実装

---

## 🔧 コンテキスト容量最適化のヒント

このプロンプトを使用する際の推奨事項：

1. **必要最小限の情報のみ参照**: 特定の機能を実装する際は、関連するセクションのみを参照
2. **ファイルを直接読む**: このプロンプトではなく、実際のファイルを読んで確認
3. **段階的な質問**: 一度に複数の機能について質問せず、1つずつ進める
4. **コード検索を活用**: `codebase_search`ツールで必要な情報を検索
5. **不要な履歴を削除**: 完了したタスクの詳細は削除して容量を確保

---

**最終更新**: 2025年1月
**バージョン**: 2.0（ファイル形式マッピング機能追加版）







