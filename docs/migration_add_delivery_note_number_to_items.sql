-- delivery_note_items テーブルに納品書番号カラムを追加
-- ヘッダーではなく明細行ごとに納品書番号を保存できるようにする

ALTER TABLE delivery_note_items
ADD COLUMN delivery_note_number VARCHAR(100);

-- 既存データがある場合、delivery_notes テーブルから納品書番号をコピー（オプション）
-- UPDATE delivery_note_items dni
-- SET delivery_note_number = dn.delivery_note_number
-- FROM delivery_notes dn
-- WHERE dni.delivery_note_id = dn.id
--   AND dn.delivery_note_number IS NOT NULL;

-- コメント追加
COMMENT ON COLUMN delivery_note_items.delivery_note_number IS '納品書番号（明細行ごとに異なる場合がある）';







