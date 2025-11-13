-- スマレジ連携用テーブル作成

CREATE TABLE IF NOT EXISTS smaregi_departments (
  id BIGSERIAL PRIMARY KEY,
  department_id VARCHAR(64) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_department_id VARCHAR(64),
  level INTEGER,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smaregi_products (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(128) NOT NULL UNIQUE,
  product_id VARCHAR(128),
  department_id VARCHAR(64),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 在庫連携を行う場合のみ利用
CREATE TABLE IF NOT EXISTS smaregi_stocks (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(128) NOT NULL,
  department_id VARCHAR(64) NOT NULL DEFAULT '',
  shop_id VARCHAR(64) NOT NULL,
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_code, department_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_smaregi_stocks_product_code ON smaregi_stocks(product_code);
CREATE INDEX IF NOT EXISTS idx_smaregi_stocks_department_id ON smaregi_stocks(department_id);
CREATE INDEX IF NOT EXISTS idx_smaregi_stocks_synced_at ON smaregi_stocks(synced_at);
