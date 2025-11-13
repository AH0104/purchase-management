-- delivery_note_items テーブルに delivery_date カラムを追加
-- 明細行ごとに異なる納品日を保存できるようにする

ALTER TABLE delivery_note_items
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- 既存データがある場合、delivery_notes テーブルの delivery_date をコピー
UPDATE delivery_note_items dni
SET delivery_date = dn.delivery_date
FROM delivery_notes dn
WHERE dni.delivery_note_id = dn.id
  AND dni.delivery_date IS NULL;

-- コメント追加
COMMENT ON COLUMN delivery_note_items.delivery_date IS '明細行ごとの納品日（1つのファイルに複数の納品日が含まれる場合に対応）';

