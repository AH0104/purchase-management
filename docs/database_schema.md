# 仕入管理システム - データベーススキーマ

## 概要

このドキュメントは、仕入管理システムで使用する全テーブルのスキーマ定義を記載しています。

## ER図（テーブル関係）

```
suppliers (仕入先マスタ)
  ↓ 1:N
delivery_notes (納品書ヘッダー)
  ↓ 1:N
delivery_note_items (納品書明細)

suppliers
  ↓ 1:N
file_format_templates (ファイル形式テンプレート)

suppliers
  ↓ 1:N
drive_import_queue (Google Drive取り込みキュー)

smaregi_departments (スマレジ部門マスタ)
  ↓ 1:N
smaregi_products (スマレジ商品マスタ)
  ↓ 1:N
smaregi_stocks (スマレジ在庫)
```

---

## 1. コアテーブル

### 1.1 suppliers（仕入先マスタ）

仕入先の基本情報を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SERIAL | NO | - | 主キー |
| supplier_code | VARCHAR(64) | NO | - | 仕入先コード（一意） |
| supplier_name | VARCHAR(255) | NO | - | 仕入先名 |
| payment_terms | INTEGER | YES | - | 支払条件（日数） |
| is_active | BOOLEAN | NO | TRUE | アクティブフラグ |
| contact_person | VARCHAR(255) | YES | - | 担当者名 |
| contact_email | VARCHAR(255) | YES | - | 連絡先メール |
| contact_phone | VARCHAR(64) | YES | - | 連絡先電話番号 |
| address | TEXT | YES | - | 住所 |
| notes | TEXT | YES | - | メモ |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス:**
- `idx_suppliers_supplier_code` (supplier_code)
- `idx_suppliers_is_active` (is_active)
- `idx_suppliers_supplier_name` (supplier_name)

**制約:**
- `supplier_code` は UNIQUE

---

### 1.2 delivery_notes（納品書ヘッダー）

納品書の基本情報を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SERIAL | NO | - | 主キー |
| supplier_id | INTEGER | YES | - | 仕入先ID（FK） |
| delivery_date | DATE | NO | - | 納品日 |
| delivery_note_number | VARCHAR(255) | YES | - | 納品書番号 |
| total_amount | NUMERIC | NO | - | 合計金額（税抜き） |
| tax_amount | NUMERIC | YES | 0 | 税額 |
| status | VARCHAR(50) | YES | 'pending' | ステータス |
| reconciled_at | TIMESTAMPTZ | YES | - | 消込日時 |
| reconciled_by | INTEGER | YES | - | 消込実行者ID |
| reconciliation_notes | TEXT | YES | - | 消込メモ |
| payment_due_date | DATE | YES | - | 支払期日 |
| paid_at | TIMESTAMPTZ | YES | - | 支払日時 |
| paid_by | INTEGER | YES | - | 支払実行者ID |
| original_file_path | VARCHAR(512) | YES | - | 元ファイルパス |
| original_file_name | VARCHAR(255) | YES | - | 元ファイル名 |
| file_type | VARCHAR(50) | YES | - | ファイル形式 |
| uploaded_by | INTEGER | YES | - | アップロード実行者ID |
| uploaded_at | TIMESTAMPTZ | YES | NOW() | アップロード日時 |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス:**
- `idx_delivery_notes_supplier_id` (supplier_id)
- `idx_delivery_notes_delivery_date` (delivery_date)
- `idx_delivery_notes_status` (status)
- `idx_delivery_notes_created_at` (created_at DESC)

**外部キー:**
- `supplier_id` → `suppliers(id)` ON DELETE SET NULL

**制約:**
- `status` は ('pending', 'reconciled', 'paid') のいずれか

---

### 1.3 delivery_note_items（納品書明細）

納品書の明細行を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SERIAL | NO | - | 主キー |
| delivery_note_id | INTEGER | YES | - | 納品書ID（FK） |
| line_number | INTEGER | YES | - | 行番号 |
| delivery_date | DATE | YES | - | 明細行ごとの納品日 |
| delivery_note_number | VARCHAR(255) | YES | - | 明細行ごとの納品書番号 |
| product_code | VARCHAR(255) | NO | - | 商品コード |
| product_name | VARCHAR(255) | NO | - | 商品名 |
| quantity | NUMERIC | NO | - | 数量 |
| unit | VARCHAR(50) | YES | '個' | 単位 |
| unit_price | NUMERIC | NO | - | 単価 |
| amount | NUMERIC | NO | - | 金額 |
| tax_rate | NUMERIC | YES | 10.00 | 税率 |
| tax_amount | NUMERIC | YES | - | 税額 |
| smaregi_product_id | VARCHAR(128) | YES | - | スマレジ商品ID |
| smaregi_synced_at | TIMESTAMPTZ | YES | - | スマレジ同期日時 |
| remarks | TEXT | YES | - | 備考 |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス:**
- `idx_delivery_note_items_delivery_note_id` (delivery_note_id)
- `idx_delivery_note_items_product_code` (product_code)
- `idx_delivery_note_items_delivery_date` (delivery_date)
- `idx_delivery_note_items_delivery_note_number` (delivery_note_number)

**外部キー:**
- `delivery_note_id` → `delivery_notes(id)` ON DELETE CASCADE

---

## 2. ファイル形式管理テーブル

### 2.1 file_format_templates（ファイル形式テンプレート）

仕入先ごとのExcel/CSVファイルのカラムマッピング設定を保存するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | BIGSERIAL | NO | - | 主キー |
| supplier_id | INTEGER | NO | - | 仕入先ID（FK） |
| file_type | VARCHAR(10) | NO | - | ファイル形式（excel/csv） |
| column_mapping | JSONB | NO | - | カラムマッピング設定 |
| header_row_index | INTEGER | NO | 0 | ヘッダー行のインデックス |
| data_start_row_index | INTEGER | NO | 1 | データ開始行のインデックス |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス:**
- `idx_file_format_templates_supplier_id` (supplier_id)
- `idx_file_format_templates_file_type` (file_type)

**外部キー:**
- `supplier_id` → `suppliers(id)` ON DELETE CASCADE

**制約:**
- `file_type` は ('excel', 'csv') のいずれか
- (supplier_id, file_type) は UNIQUE

---

## 3. Google Drive連携テーブル

### 3.1 drive_import_queue（Google Drive取り込みキュー）

Google Drive監視フォルダから取り込んだファイルの処理キュー。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | BIGSERIAL | NO | - | 主キー |
| file_id | TEXT | NO | - | DriveファイルID（UNIQUE） |
| file_name | TEXT | NO | - | ファイル名 |
| mime_type | TEXT | YES | - | MIMEタイプ |
| md5_checksum | TEXT | YES | - | MD5チェックサム |
| supplier_id | INTEGER | YES | - | 仕入先ID（FK） |
| inferred_supplier_code | TEXT | YES | - | 推定仕入先コード |
| inferred_supplier_name | TEXT | YES | - | 推定仕入先名 |
| source_folder_id | TEXT | YES | - | ソースフォルダID |
| source_folder_name | TEXT | YES | - | ソースフォルダ名 |
| source_path | TEXT | YES | - | ソースパス |
| web_view_link | TEXT | YES | - | Webビューリンク |
| size | BIGINT | YES | - | ファイルサイズ（バイト） |
| drive_created_time | TIMESTAMPTZ | YES | - | Drive作成日時 |
| drive_modified_time | TIMESTAMPTZ | YES | - | Drive更新日時 |
| status | TEXT | NO | 'pending_supplier' | ステータス |
| error_message | TEXT | YES | - | エラーメッセージ |
| last_error_at | TIMESTAMPTZ | YES | - | 最終エラー日時 |
| processed_at | TIMESTAMPTZ | YES | - | 処理完了日時 |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス:**
- `idx_drive_import_queue_status` (status)
- `idx_drive_import_queue_supplier_id` (supplier_id)
- `idx_drive_import_queue_created_at` (created_at DESC)

**外部キー:**
- `supplier_id` → `suppliers(id)` ON DELETE SET NULL

**制約:**
- `file_id` は UNIQUE
- `status` は ('pending', 'pending_supplier', 'ready', 'processing', 'processed', 'error') のいずれか

---

### 3.2 drive_sync_state（Google Drive同期状態）

Google Drive Changes APIの同期トークン管理テーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SMALLINT | NO | 1 | 主キー（常に1） |
| watch_folder_id | TEXT | NO | - | 監視フォルダID |
| page_token | TEXT | YES | - | ページトークン |
| start_page_token | TEXT | YES | - | 開始ページトークン |
| last_synced_at | TIMESTAMPTZ | YES | - | 最終同期日時 |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**制約:**
- `id` は常に 1（シングルトン）

---

## 4. スマレジ連携テーブル

### 4.1 smaregi_departments（スマレジ部門マスタ）

スマレジPOSシステムの部門情報を保存するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | BIGSERIAL | NO | - | 主キー |
| department_id | VARCHAR(64) | NO | - | 部門ID（スマレジ、UNIQUE） |
| name | TEXT | NO | - | 部門名 |
| parent_department_id | VARCHAR(64) | YES | - | 親部門ID |
| level | INTEGER | YES | - | 階層レベル |
| synced_at | TIMESTAMPTZ | NO | NOW() | 同期日時 |

**制約:**
- `department_id` は UNIQUE

---

### 4.2 smaregi_products（スマレジ商品マスタ）

スマレジPOSシステムの商品情報を保存するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | BIGSERIAL | NO | - | 主キー |
| product_code | VARCHAR(128) | NO | - | 商品コード（UNIQUE） |
| product_id | VARCHAR(128) | YES | - | 商品ID（スマレジ） |
| department_id | VARCHAR(64) | YES | - | 部門ID |
| synced_at | TIMESTAMPTZ | NO | NOW() | 同期日時 |

**制約:**
- `product_code` は UNIQUE

---

### 4.3 smaregi_stocks（スマレジ在庫）

スマレジPOSシステムの在庫情報を保存するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | BIGSERIAL | NO | - | 主キー |
| product_code | VARCHAR(128) | NO | - | 商品コード |
| department_id | VARCHAR(64) | NO | '' | 部門ID |
| shop_id | VARCHAR(64) | NO | - | 店舗ID |
| stock_quantity | NUMERIC | NO | 0 | 在庫数量 |
| unit | TEXT | YES | - | 単位 |
| synced_at | TIMESTAMPTZ | NO | NOW() | 同期日時 |

**インデックス:**
- `idx_smaregi_stocks_product_code` (product_code)
- `idx_smaregi_stocks_department_id` (department_id)
- `idx_smaregi_stocks_synced_at` (synced_at)

**制約:**
- (product_code, department_id, shop_id) は UNIQUE

---

## 5. その他のテーブル

### 5.1 audit_logs（監査ログ）

システムの操作ログを記録するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SERIAL | NO | - | 主キー |
| user_id | INTEGER | YES | - | ユーザーID |
| action | VARCHAR | NO | - | アクション |
| target_table | VARCHAR | YES | - | 対象テーブル |
| target_id | INTEGER | YES | - | 対象レコードID |
| old_value | JSONB | YES | - | 変更前の値 |
| new_value | JSONB | YES | - | 変更後の値 |
| ip_address | VARCHAR | YES | - | IPアドレス |
| user_agent | TEXT | YES | - | ユーザーエージェント |
| created_at | TIMESTAMPTZ | YES | NOW() | 作成日時 |

---

### 5.2 budgets（予算管理）

月次予算を管理するテーブル。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| id | SERIAL | NO | - | 主キー |
| year | INTEGER | NO | - | 年 |
| month | INTEGER | NO | - | 月 |
| supplier_id | INTEGER | YES | - | 仕入先ID（FK） |
| budget_amount | NUMERIC | NO | - | 予算金額 |
| created_at | TIMESTAMPTZ | YES | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | YES | NOW() | 更新日時 |

**外部キー:**
- `supplier_id` → `suppliers(id)`

---

## マイグレーション実行順序

Supabaseで新規にデータベースを構築する場合、以下の順序でマイグレーションを実行してください：

1. `migration_create_suppliers.sql` - 仕入先マスタ
2. `migration_create_delivery_tables.sql` - 納品書関連テーブル
3. `migration_create_file_format_templates.sql` - ファイル形式テンプレート
4. `migration_update_file_format_templates_add_delivery_date.sql` - テンプレート拡張
5. `migration_add_delivery_date_to_items.sql` - 明細行に納品日追加
6. `migration_add_delivery_note_number_to_items.sql` - 明細行に納品書番号追加
7. `migration_create_drive_tables.sql` - Google Drive連携テーブル
8. `migration_create_smaregi_tables.sql` - スマレジ連携テーブル

---

## 注意事項

- 全てのテーブルに `created_at` と `updated_at` カラムが存在します
- `updated_at` は自動的に更新されるトリガーが設定されています
- 外部キー制約により、関連データの整合性が保証されています
- インデックスは検索パフォーマンス向上のために設定されています

---

**最終更新日:** 2025-11-17
