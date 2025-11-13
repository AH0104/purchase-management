## ファイルアップロード & 解析パイプライン設計

### 目的
- 10MB 程度の PDF / Excel / CSV を高速にアップロードし、即座にプレビューを返す。
- Gemini OCR を含む重い処理は非同期化し、UI でローディングや途中経過を表示。
- 最終的に `delivery_notes` / `delivery_note_items` に正規化データを保存。

### 全体フロー概要
1. **クライアント**: ファイル選択→事前バリデーション→チャンク送信（Progress 表示）。
2. **Next.js Route Handler** (`POST /api/uploads`): Supabase Storage にストリーミング保存、メタ情報をキューへ投入。
3. **解析ワーカー (Route Handler + Edge Function)**:
   - Excel/CSV: すぐに `xlsx` / `papaparse` で解析し JSON へ。
   - PDF: Gemini API に非同期リクエスト、結果を Supabase に格納。
4. **クライアント**: `uploadId` でポーリング／SSE → プレビュー画面に段階的に表示。
5. **保存処理**: ユーザーが編集後、`POST /api/delivery-notes` でトランザクション保存。

### 主要コンポーネント

| 層 | 役割 | 実装案 |
| --- | --- | --- |
| `src/app/upload` | UI、進捗表示、プレビュー、編集フォーム | React Hook Form + Zustand（セッション状態） |
| `src/app/api/uploads/route.ts` | アップロード受付、Storage 保存、キュー追加 | Node Streams, Supabase Storage |
| `src/app/api/uploads/[id]/route.ts` | ステータス取得（ポーリング/SSE） | Supabase DB 参照 |
| `src/lib/parsers/*.ts` | Excel, CSV, PDF 共通インターフェース | `parseExcel`, `parseCsv`, `parsePdfGemini` |
| `src/lib/normalizers/*.ts` | 日付/数値正規化 | Zod スキーマ |
| `src/app/api/delivery-notes/route.ts` | 保存処理 (transaction) | Supabase RPC/SQL |

### パフォーマンス配慮
- **チャンクアップロード**: `fetch` + `ReadableStream` / `FormData`。10MB 程度なら単一送信で十分だが、進捗イベントを表示できるよう `XMLHttpRequest` との切替を検討。
- **即時フィードバック**: クライアントで可能な解析（Excel/CSV）はアップロード前に先行解析し、サーバー解析と突合。
- **スロットリング**: Gemini API 呼出しは同時 3 並列に制御。
- **キャッシュ**: 同じファイル再アップロード時にハッシュ照合し結果を再利用。

### データモデル（ステータス管理）
Supabase `uploads` テーブル（新規作成予定）に以下を保持。
- `id`, `supplier_id`, `file_name`, `status` (`pending`/`parsing`/`ready`/`failed`), `type`, `storage_path`, `preview_payload`, `error`。

### 今後のタスク分解
1. `uploads` テーブルと API の scaffold。
2. クライアントのアップロード UI + 状態管理。
3. Excel/CSV パーサーモジュール作成。
4. Gemini 連携 Route Handler / 解析フロー。
5. プレビュー編集画面と保存 API。
6. 統合テスト（アップロード～保存）。

---

この設計をベースに実装を開始します。API エンドポイントやテーブル設計に変更希望があれば早めにご連絡ください。







