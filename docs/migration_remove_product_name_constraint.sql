-- smaregi_products の NOT NULL 制約を削除
-- product_id と product_name は、スマレジAPIから取得できない場合があるため、nullableにする

-- product_id カラムの NOT NULL 制約を削除
ALTER TABLE smaregi_products
ALTER COLUMN product_id DROP NOT NULL;

-- product_name カラムの NOT NULL 制約を削除
ALTER TABLE smaregi_products
ALTER COLUMN product_name DROP NOT NULL;
