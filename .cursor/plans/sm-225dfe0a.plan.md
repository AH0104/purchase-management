<!-- 225dfe0a-d40f-46e9-a308-663a13e5543e af750f3b-4551-448e-a182-d15586ac6208 -->
# Google Drive自動取り込み計画

## 要約

- 個人アカウントによるOAuthでDriveフォルダを監視し、フォルダ名で仕入先を推定。処理済み/保留に応じてファイルを自動移動する。

## 実装ステップ

1. OAuth設定

- Google Cloud ConsoleでOAuthクライアントID作成（デスクトップorウェブ）
- ユーザー承認フロー実装し、リフレッシュトークンを取得して安全に保存
- `.env.local` に `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, 監視フォルダID/処理済みフォルダIDなどを追加

2. Drive API連携基盤

- `googleapis` 依存を追加
- `lib/google/drive.ts` でOAuth2クライアント・トークン更新・ファイル一覧/取得/移動を実装
- フォルダ階層／フォルダ名から仕入先コードを推定するヘルパーを用意

3. 変更検知とインポートキュー

- Drive Changes APIで差分検出し最新ページトークンを `drive_sync_state` に保存
- 新規ファイルを `drive_import_queue` に登録（推定仕入先・ステータス付与）
- フォルダ名に対応する仕入先が無い場合は `status=pending_supplier`

4. 保留BOXUIとアップロード連携

- 管理画面に保留一覧を追加（ステータス別フィルタ、仕入先/テンプレート選択）
- ユーザー補正後に既存アップロード処理へ投入し、成功時は Drive ファイルを処理済みフォルダへ移動し `status=processed`
- 解析エラーは `status=error` に更新し再処理可能にする。保留中は保留フォルダに保持

5. 自動実行

- Vercel Cron などで `/api/drive/poll` を定期実行（例: 5分毎）
- ファイルID & MD5で重複防止、ログ/通知を追加

6. ドキュメント整備

- `docs/google_drive_auto_import.md` にOAuth認証手順、フォルダ構成、保留BOX操作方法を記載

## 追加検討

- 新規仕入先登録を保留BOXUIから直接行えるようにする
- エラー発生時のSlack/メール通知
- 大量ファイルに備えたバッチ制御や並列処理の最適化

### To-dos

- [ ] Google Driveサービスアカウントの設定と環境変数整備
- [ ] Drive APIクライアント実装とフォルダ差分取得基盤
- [ ] Drive新規ファイルを既存アップロード処理へ連携し、重複・保留処理を追加
- [ ] セットアップ＆運用手順ドキュメント作成