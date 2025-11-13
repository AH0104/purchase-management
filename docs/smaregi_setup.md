# スマレジ連携設定手順

このドキュメントではスマレジ Developer API を利用して部門と商品を本システムに同期するための設定手順をまとめます（在庫同期は任意です）。

## 1. スマレジ側の準備

1. [スマレジ デベロッパーサイト](https://developer.smaregi.jp/) にログインします。
2. 「アプリ登録」より新規アプリを作成し、以下を確認します。
   - **クライアントID / クライアントシークレット** を控える
   - 権限スコープに「在庫参照 (pos.inventory.read)」等、必要な権限を付与
   - リダイレクトURLは不要（クライアントクレデンシャルズ利用のため）
3. テナントID（管理画面の店舗ID）と在庫取得対象のショップIDを確認します。
4. スマレジの**契約ID**（例: `sb_xxxxxxxx`）を確認します。Sandbox の場合はテナントIDと同一値です。
4. API エンドポイントの環境（本番/テスト）に応じて、以下のベースURLを把握します。
   - API BASE: `https://api.smaregi.jp`（本番）
   - AUTH BASE: `https://id.smaregi.jp`（本番）

> Sandbox 環境を利用する場合は `https://api.smaregi.dev` / `https://id.smaregi.dev` を指定します。

## 2. 環境変数の設定

`web/env.sample.txt` を参考に `.env.local` を作成し、下記の値を設定します。

```
SMAREGI_CLIENT_ID=xxxxxxxx
SMAREGI_CLIENT_SECRET=xxxxxxxx
SMAREGI_TENANT_ID=xxxxxxxx
SMAREGI_SHOP_ID=xxxxxxxx
SMAREGI_CONTRACT_ID=xxxxxxxx
SMAREGI_API_BASE=https://api.smaregi.jp
SMAREGI_AUTH_BASE=https://id.smaregi.jp
SMAREGI_SCOPE=pos.inventory.read
SMAREGI_SYNC_SECRET=任意の長いランダム文字列
```

- `SMAREGI_SCOPE` には `products.read` や `departments.read` など必要なスコープをスペース区切りで追加してください。`pos.inventory.read` は将来の在庫連携用です。
- `SMAREGI_CONTRACT_ID` はアクセストークン発行時のエンドポイントに使用します。未設定の場合は自動的に `SMAREGI_TENANT_ID` が利用されます。
- `SMAREGI_SYNC_SECRET` は同期APIの簡易認証に使用します（Vercel Cron などから利用）。

## 3. アプリアクセストークンの取得

クライアントクレデンシャルズフローを利用してアクセストークンを取得します。

- エンドポイント: `POST {SMAREGI_AUTH_BASE}/app/{SMAREGI_CONTRACT_ID}/token`
- ヘッダー:
  - `Authorization: Basic {base64(SMAREGI_CLIENT_ID:SMAREGI_CLIENT_SECRET)}`
  - `Content-Type: application/x-www-form-urlencoded`
- ボディ（`x-www-form-urlencoded`）:
  - `grant_type=client_credentials`
  - `scope={SMAREGI_SCOPE}`

`curl` 例（Sandbox）:

```
curl -X POST https://id.smaregi.dev/app/sb_skx360u8/token \
  -H "Authorization: Basic $(printf '%s' "$SMAREGI_CLIENT_ID:$SMAREGI_CLIENT_SECRET" | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=products.read%20departments.read"
```

応答で返る `access_token` を `Authorization: Bearer` に指定すると GraphQL / REST API が呼び出せます。  
アプリ内ではこのリクエストが自動的に実行され、トークンはキャッシュされます。

## 4. 同期 API の利用

- ルート: `POST /api/smaregi/sync`
- ヘッダー: `x-cron-secret: {SMAREGI_SYNC_SECRET}`

Vercel の Scheduled Function で毎時実行する場合は以下のように設定します。

```
Path: /api/smaregi/sync
Cron: 0 * * * *
Headers:
  x-cron-secret: {SMAREGI_SYNC_SECRET}
```

手動同期を行う場合は、ローカル/ダッシュボードから `fetch("/api/smaregi/sync", { method: "POST", headers: { "x-cron-secret": SECRET } })` で呼び出せます。

## 5. データの確認

- `smaregi_departments` テーブルに部門情報が格納されます。
- `smaregi_products` テーブルに商品コード・商品ID・部門IDが格納されます。
- ダッシュボード（`/`）で部門別仕入金額が表示され、同期時刻も上部カードで確認できます。

## 6. 商品コードとの紐付け

- 仕入明細 (`delivery_note_items.product_code`) がスマレジの商品コードと一致している場合、自動的に部門へ紐付けられます。
- コードが一致しない場合は「未分類」に集計されるため、商品マスタのクレンジングやマッピングテーブルの整備をご検討ください。
- 必要に応じて `smaregi_products` を手動更新（CSVインポート等）して補正することも可能です。

## 7. 注意事項

- スマレジAPIのレート制限を超えないよう、必要に応じて同期間隔を調整してください。
- 将来的に在庫を扱う場合は `smaregi_stocks` テーブルを利用できます（現在は未使用）。
- 商品マスタが更新された場合は再同期を実行して部門IDを最新化してください。

