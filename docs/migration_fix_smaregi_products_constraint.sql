-- smaregi_products テーブルに UNIQUE 制約を追加
-- テーブルが存在しない場合は作成し、存在する場合は制約のみ追加

-- テーブルが存在するか確認して、なければ作成
CREATE TABLE IF NOT EXISTS smaregi_products (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(128) NOT NULL,
  product_id VARCHAR(128),
  product_name TEXT,
  department_id VARCHAR(64),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- product_name カラムを追加（既に存在する場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smaregi_products' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE smaregi_products ADD COLUMN product_name TEXT;
  END IF;
END $$;

-- UNIQUE 制約を追加（既に存在する場合はエラーを無視）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'smaregi_products_product_code_key'
  ) THEN
    ALTER TABLE smaregi_products
    ADD CONSTRAINT smaregi_products_product_code_key
    UNIQUE (product_code);
  END IF;
END $$;

-- インデックスを作成（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_smaregi_products_department_id ON smaregi_products(department_id);
CREATE INDEX IF NOT EXISTS idx_smaregi_products_synced_at ON smaregi_products(synced_at);
