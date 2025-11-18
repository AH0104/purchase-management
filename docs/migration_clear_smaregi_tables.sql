-- スマレジ関連テーブルをクリア
-- 古いデータには部門名が含まれていないため、再同期が必要

TRUNCATE TABLE smaregi_products;
TRUNCATE TABLE smaregi_departments;
