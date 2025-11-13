# Google Drive 自動取り込みフロー

## 概要

Google Drive 上の監視フォルダにアップロードされたファイルを自動で検出し、仕入先推定 → 保留BOX → 既存アップロード処理へ連携するフローです。PDF / Excel / CSV をサポートし、テンプレートマッピングも既存の `file_format_templates` テーブルを再利用します。

## 必要な環境変数

`.env.local` に以下を追加してください。

```
GOOGLE_CLIENT_ID=           # OAuth クライアント（デスクトップ or ウェブアプリ）の Client ID
GOOGLE_CLIENT_SECRET=       # Client Secret
GOOGLE_REFRESH_TOKEN=       # CLI などで取得したリフレッシュトークン
GOOGLE_DRIVE_WATCH_FOLDER_ID=      # 監視フォルダ（アップロード置き場）の ID
GOOGLE_DRIVE_PROCESSED_FOLDER_ID=  # 処理済みファイルを移動するフォルダ ID（任意）
GOOGLE_DRIVE_PENDING_FOLDER_ID=    # 保留中ファイルを移動するフォルダ ID（任意）
```

> 補足: 初回同期用の `pageToken` は `drive_sync_state` テーブルで管理するため、環境変数での設定は不要になりました。テーブルが空の場合、`/api/drive/poll` 実行時に `startPageToken` が自動生成されます。

## データベース

- `drive_import_queue`: Drive から取り込まれたファイルの保留情報を保持。仕入先推定結果や処理ステータス、エラーメッセージなどを保存します。
- `drive_sync_state`: Google Drive Changes API のページトークン管理。監視フォルダ ID と最新トークンを保存します。

`docs/migration_create_drive_tables.sql` を Supabase 環境に適用してください。

## フロー概要

1. **ポーリング (`/api/drive/poll`)**
   - Google Drive Changes API から監視フォルダ配下の変更を取得。
   - フォルダ名から仕入先コード / 名を推定し、`drive_import_queue` に upsert。
   - 仕入先が推定できない場合は `status=pending_supplier` として保留フォルダ（指定があれば移動）に退避。
   - 仕入先が推定できた場合は `status=pending` として処理待ちキューに積みます。

2. **保留BOX UI (`/drive-imports`)**
   - 保留中ファイルの一覧・フィルタリング・ステータス変更・仕入先確定を行う UI。
   - 仕入先を手動で設定すると `status=pending` に更新。処理ボタンで解析・取り込みを実行。
   - 解析エラーが発生した場合は `status=error` となり再実行が可能。

3. **処理実行 (`/api/drive/import-queue/:id/process`)**
   - Drive からファイルをダウンロードし、ファイル種別ごとに解析。
   - Excel / CSV はテンプレートがあれば適用、なければ従来ロジックで抽出。
   - 納品書データを `delivery_notes` / `delivery_note_items` に保存し、処理済みフォルダへ移動。

## 自動実行（Cron）

Vercel Cron などから 5 分間隔程度で `/api/drive/poll` を叩く想定です。処理負荷を抑えるため、1 回のリクエストで 100 件ずつ Changes API を読み進めます。`drive_import_queue` の重複防止は `file_id` の一意制約で担保しています。

## 保留BOX運用のヒント

- フォルダ階層は `監視フォルダ / 仕入先名 / ファイル` の構成を推奨。仕入先コード・名称を正規化して照合します。
- `status=pending_supplier` のファイルは `GOOGLE_DRIVE_PENDING_FOLDER_ID` が設定されていれば自動で保留フォルダへ移動します。
- `status=processed` になったファイルは `GOOGLE_DRIVE_PROCESSED_FOLDER_ID` へ移動します（設定されている場合）。
- 新規仕入先が推定できない場合は保留BOXで仕入先を作成 → 再度割り当ててから取り込みます。

## エラー通知とログ

- API レスポンスは `error` フィールドにメッセージを返却します。必要に応じて Slack / メール通知を追加してください。
- 解析エラーは `drive_import_queue.error_message` に保存され、保留BOX UI にも表示されます。

## TODO / 拡張案

- Slack など外部通知の追加。
- 大量ファイル処理時のバッチ制御 / 並列数制限。
- Drive Webhook (`push notifications`) への拡張。
- 保留BOXから直接仕入先を登録するフローの追加。








