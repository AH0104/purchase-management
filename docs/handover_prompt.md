# 仕入支払管理システム - 引き継ぎプロンプト

## 🎯 プロジェクト概要

取引先から送られてくる様々な形式（Excel、PDF、CSV）の納品書・請求書を、AIで自動解析してデータベースに登録し、仕入状況をリアルタイムで管理するWebシステム。

### 対象ユーザー
- 社内スタッフ3名（非エンジニア）
- 取引先数：約50社
- 月間処理量：約10,000行のデータ

---

## ✅ 完了した作業

### 1. プロジェクトセットアップ
- Next.js 16 + TypeScript + Tailwind CSS でプロジェクト構築
- Supabase 接続設定完了
- Google Gemini API 接続設定完了
- 必要な依存関係インストール済み

### 2. UI実装
- **レイアウト**: freee/スマレジ風のサイドナビゲーション（左側固定サイドバー）
- **主要ページ**:
  - ダッシュボード（`/`）
  - 納品データ一覧（`/data`）
  - ファイルアップロード（`/upload`）
  - 仕入先管理（`/suppliers`）
  - 分析（`/analysis` - 将来拡張用）

### 3. ファイルアップロード & 解析機能
- **対応形式**: PDF、Excel (.xlsx, .xls)、CSV
- **PDF解析**: Google Gemini API (gemini-2.5-flash) を使用
- **Excel/CSV解析**: xlsx、papaparse ライブラリを使用
- **3ステップフロー**:
  1. ファイル選択（仕入先選択 + ファイルアップロード）
  2. データ確認・編集（ヘッダー情報 + 明細テーブル）
  3. 保存完了

### 4. データ構造
- **型定義**: `src/types/delivery.ts`
- **バリデーション**: Zod スキーマ（`src/lib/validators/delivery.ts`）
- **データモデル**:
  - ヘッダー: 仕入先、納品日、合計金額（税抜き）
  - 明細: 納品書番号、商品コード、商品名、数量、単価、金額（税抜き）、備考

### 5. データベース
- **Supabase URL**: `https://bbmurljkyinqqpvqzryx.supabase.co`
- **既存テーブル**: 
  - `suppliers`（仕入先マスタ）
  - `delivery_notes`（納品書ヘッダー）
  - `delivery_note_items`（納品書明細）
- **マイグレーション必要**: `docs/migration_add_delivery_note_number_to_items.sql` を実行済み（`delivery_note_items` テーブルに `delivery_note_number` カラム追加）

---

## 📋 現在の状態

### 動作確認済み
- ✅ PDF ファイルのアップロードと Gemini による解析
- ✅ 納品書番号の抽出（明細行ごと）
- ✅ 明細データの抽出と表示
- ✅ データの編集機能
- ✅ データベースへの保存

### 実装済み機能
- ファイルアップロード（進捗表示付き）
- PDF/Excel/CSV の自動解析
- データプレビューとインライン編集
- バリデーション（Zod）
- エラーハンドリング
- トースト通知（sonner）

### UI仕様
- **商品名**: 最小幅 400px（長い商品名に対応）
- **商品コード**: 幅 40px（14桁対応）
- **数量**: 幅 20px（4桁）
- **単価**: 幅 24px（6桁）
- **金額**: 幅 28px（7桁）

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
- **通知**: sonner

---

## 📁 重要なファイル構成

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 共通レイアウト（サイドナビ）
│   │   ├── page.tsx            # ダッシュボード
│   │   ├── upload/page.tsx     # アップロード画面
│   │   ├── data/page.tsx       # 納品データ一覧
│   │   ├── suppliers/page.tsx  # 仕入先管理
│   │   └── api/
│   │       ├── uploads/route.ts        # ファイル解析API
│   │       └── delivery-notes/route.ts # データ保存API
│   ├── lib/
│   │   ├── supabaseClient.ts   # Supabase クライアント
│   │   ├── gemini.ts           # Gemini API クライアント
│   │   ├── parsers/
│   │   │   ├── pdf.ts          # PDF解析（Gemini使用）
│   │   │   ├── excel.ts        # Excel解析
│   │   │   ├── csv.ts          # CSV解析
│   │   │   └── utils.ts        # 共通ユーティリティ
│   │   └── validators/
│   │       └── delivery.ts    # Zod スキーマ
│   ├── types/
│   │   ├── delivery.ts        # 納品書関連の型定義
│   │   └── supplier.ts        # 仕入先関連の型定義
│   └── store/
│       └── uploadStore.ts     # アップロード状態管理
├── .env.local                  # 環境変数（要設定）
└── env.sample.txt             # 環境変数サンプル
```

---

## 🚀 今後のタスク

### 優先度：高

1. **ダッシュボード機能の実装**
   - 今月の仕入総額表示
   - 未処理件数表示
   - 仕入先別集計グラフ（recharts 使用）
   - 直近のアップロード一覧

2. **納品データ一覧の機能実装**
   - 期間フィルタ
   - 仕入先フィルタ
   - ステータスフィルタ
   - キーワード検索
   - 詳細表示（サイドパネル）
   - CSV/Excel エクスポート

3. **仕入先管理の機能実装**
   - 仕入先一覧表示（Supabase から取得）
   - 新規登録（ドロワーフォーム）
   - 編集・削除機能
   - 検索・フィルタ機能

### 優先度：中

4. **データベースクエリ最適化**
   - 集計クエリの実装
   - インデックスの確認・追加

5. **エラーハンドリングの強化**
   - より詳細なエラーメッセージ
   - リトライ機能

6. **パフォーマンス最適化**
   - 大きなファイルの処理
   - リスト表示の仮想化（必要に応じて）

### 優先度：低

7. **分析機能の実装**
   - 月次トレンドグラフ
   - 仕入先別分析
   - 商品別分析

8. **その他の機能**
   - データエクスポート（CSV/Excel）
   - バッチ処理
   - 操作ログ

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

---

## 📚 参考ドキュメント

- `docs/mockup.md`: UIモックアップ
- `docs/upload_plan.md`: アップロード機能の設計
- `docs/migration_add_delivery_note_number_to_items.sql`: データベースマイグレーション

---

## 💡 開発の進め方

1. **段階的な実装**: 一度にすべてを作らず、機能ごとに動作確認
2. **ユーザビリティ優先**: 非エンジニアが使うため、直感的な操作性を重視
3. **エラーメッセージ**: 日本語でわかりやすく表示
4. **パフォーマンス**: 処理速度を重視（特にファイルアップロードとOCR解析）

---

**現在の状態**: 基本的なファイルアップロード・解析・保存機能は動作確認済み。次のステップはダッシュボードとデータ一覧機能の実装。







