# Vercel Cron設定ガイド

## 概要

仕入管理システムでは、以下の2つの機能を定期的に自動実行する必要があります：

1. **Google Drive自動ポーリング** - 監視フォルダの新しいファイルを検出
2. **Smaregi自動同期** - 部門・商品マスタの同期

Vercel Cronを使用して、これらの機能を自動実行します。

---

## Vercel Cron設定（vercel.json）

プロジェクトルート(`/web/vercel.json`)に以下の設定が既に含まれています：

```json
{
  "crons": [
    {
      "path": "/api/drive/poll",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/smaregi/sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

### スケジュール説明

| パス | スケジュール | 実行頻度 | 説明 |
|------|------------|---------|------|
| `/api/drive/poll` | `*/5 * * * *` | 5分ごと | Google Driveの変更をチェック |
| `/api/smaregi/sync` | `0 * * * *` | 毎時0分 | Smaregiデータを同期 |

### Cron式の読み方

```
*/5 * * * *
│   │ │ │ │
│   │ │ │ └─ 曜日 (0-7、0と7は日曜日)
│   │ │ └─── 月 (1-12)
│   │ └───── 日 (1-31)
│   └─────── 時 (0-23)
└─────────── 分 (0-59)

*/5 = 5分ごと
0 = 毎時0分
```

---

## Vercelダッシュボードでの設定

### 1. Vercel Proプランへのアップグレード

Vercel Cronは **Pro プラン以上**で利用可能です。

- **無料プラン**: Cron機能は利用不可
- **Proプラン（$20/月）**: 無制限のCron Job

### 2. Cron Jobの有効化

1. Vercelダッシュボードにログイン
2. プロジェクト「purchase-management」を選択
3. **Settings** → **Cron Jobs** へ移動
4. 自動的に `vercel.json` の設定が読み込まれます
5. 各Cron Jobのステータスを確認

### 3. 環境変数の設定（重要）

Cron Jobが正常に動作するために、以下の環境変数が必要です：

#### Google Drive連携

```
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_WATCH_FOLDER_ID=...
```

#### Smaregi連携

```
SMAREGI_CONTRACT_ID=...
SMAREGI_CLIENT_ID=...
SMAREGI_CLIENT_SECRET=...
SMAREGI_SYNC_SECRET=...  # Cronエンドポイント保護用
```

#### Supabase

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

環境変数の設定方法は `docs/vercel_env_setup.md` を参照してください。

---

## 手動実行（テスト用）

Cron Jobを手動でテストする場合：

### Google Driveポーリング

```bash
curl -X POST https://purchase-management-brown.vercel.app/api/drive/poll \
  -H "x-cron-secret: YOUR_SECRET"
```

### Smaregi同期

```bash
curl -X POST https://purchase-management-brown.vercel.app/api/smaregi/sync \
  -H "x-cron-secret: YOUR_SMAREGI_SYNC_SECRET"
```

**レスポンス例：**

```json
{
  "status": "ok",
  "processedCount": 3,
  "skippedCount": 0,
  "errorCount": 0
}
```

---

## ローカル開発環境での代替手段

ローカルでCron機能をテストする場合、以下の方法があります：

### 方法1: 手動API呼び出し

```bash
# ローカルサーバーを起動
npm run dev

# 別のターミナルでAPIを呼び出し
curl -X POST http://localhost:3000/api/drive/poll
curl -X POST http://localhost:3000/api/smaregi/sync
```

### 方法2: node-cronを使用（開発環境のみ）

開発環境でのみCronを動かしたい場合、`node-cron`パッケージを追加できます：

```bash
npm install node-cron @types/node-cron --save-dev
```

`scripts/dev-cron.ts` を作成：

```typescript
import cron from 'node-cron';

// 5分ごとにGoogle Driveポーリング
cron.schedule('*/5 * * * *', async () => {
  console.log('[Cron] Google Driveポーリング開始');
  await fetch('http://localhost:3000/api/drive/poll', { method: 'POST' });
});

// 1時間ごとにSmaregi同期
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Smaregi同期開始');
  await fetch('http://localhost:3000/api/smaregi/sync', { method: 'POST' });
});

console.log('Dev Cron started');
```

---

## モニタリング

### Vercelダッシュボードでの確認

1. **Deployments** → 最新のデプロイを選択
2. **Functions** タブで各Cron Jobの実行ログを確認
3. エラーがあれば **Logs** に表示されます

### Supabaseでの確認

#### Google Drive取り込みキューの確認

```sql
SELECT status, COUNT(*) as count
FROM drive_import_queue
GROUP BY status
ORDER BY count DESC;
```

#### Smaregi同期状況の確認

```sql
SELECT
  MAX(synced_at) as last_department_sync
FROM smaregi_departments;

SELECT
  MAX(synced_at) as last_product_sync
FROM smaregi_products;
```

---

## トラブルシューティング

### Cron Jobが実行されない

1. **Vercel Proプランを確認**
   - 無料プランではCron機能は利用できません

2. **vercel.jsonの配置を確認**
   - `/web/vercel.json` に正しく配置されているか

3. **デプロイを確認**
   - 最新のデプロイに `vercel.json` が含まれているか

4. **環境変数を確認**
   - Vercelダッシュボードで必要な環境変数が設定されているか

### Cron Jobがエラーになる

1. **Vercelログを確認**
   - Deployments → Functions → Logsでエラー内容を確認

2. **手動実行でテスト**
   - curlコマンドで手動実行して、エラー内容を確認

3. **認証エラー**
   - `SMAREGI_SYNC_SECRET` が正しく設定されているか
   - Google Drive APIの認証情報が正しいか

---

## スケジュール変更方法

スケジュールを変更する場合：

1. `/web/vercel.json` を編集
2. Git commit & push
3. Vercelが自動でデプロイ
4. Vercelダッシュボードで新しいスケジュールを確認

### スケジュール例

```json
{
  "crons": [
    // 10分ごと
    {
      "path": "/api/drive/poll",
      "schedule": "*/10 * * * *"
    },
    // 毎日午前3時
    {
      "path": "/api/smaregi/sync",
      "schedule": "0 3 * * *"
    },
    // 平日の営業時間のみ（月〜金 9-18時）
    {
      "path": "/api/custom-job",
      "schedule": "0 9-18 * * 1-5"
    }
  ]
}
```

---

## セキュリティベストプラクティス

### 1. エンドポイント保護

Cronエンドポイントは公開されているため、認証を追加：

```typescript
// /api/smaregi/sync/route.ts
function checkAuth(request: Request) {
  const secret = process.env.SMAREGI_SYNC_SECRET;
  if (!secret) return true; // 開発環境

  const header = request.headers.get("x-cron-secret");
  return header === secret;
}
```

### 2. IP制限（オプション）

Vercelの Cron Jobは特定のIPアドレスから実行されます。
必要に応じてIP制限を追加できます。

### 3. レート制限

APIの過剰な呼び出しを防ぐため、レート制限を実装：

```typescript
// 簡易的なレート制限の例
const lastRun = new Map<string, number>();

function checkRateLimit(key: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const last = lastRun.get(key) || 0;

  if (now - last < minIntervalMs) {
    return false; // レート制限超過
  }

  lastRun.set(key, now);
  return true;
}
```

---

## まとめ

- ✅ Vercel Cronで自動実行を設定
- ✅ Google Driveポーリング: 5分ごと
- ✅ Smaregi同期: 1時間ごと
- ✅ Vercel Proプランが必要
- ✅ 環境変数の設定が必須
- ✅ ログでモニタリング

**次のステップ:**
1. Vercel Proプランにアップグレード
2. 環境変数を設定
3. デプロイ後、Cron Jobが動作していることを確認
4. ログをモニタリング

---

**最終更新日:** 2025-11-17
