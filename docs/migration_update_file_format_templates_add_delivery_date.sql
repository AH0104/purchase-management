-- file_format_templates の column_mapping に delivery_date キーを追加
-- 既存テンプレートとの互換性確保のため、未設定の場合は空オブジェクトを追加

UPDATE file_format_templates
SET column_mapping = jsonb_set(column_mapping, '{delivery_date}', '{}'::jsonb, true)
WHERE NOT (column_mapping ? 'delivery_date');

-- コメント: delivery_date は明細行ごとの納品日カラムマッピングを保持

