-- smaregi_products の product_name NOT NULL 制約を削除
-- 商品名は必須ではないため、NULL許可にする

-- product_name カラムの NOT NULL 制約を削除
ALTER TABLE smaregi_products
ALTER COLUMN product_name DROP NOT NULL;
