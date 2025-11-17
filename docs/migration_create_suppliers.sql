-- suppliers テーブルを作成
-- 仕入先マスタ

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  supplier_code VARCHAR(64) NOT NULL UNIQUE,
  supplier_name VARCHAR(255) NOT NULL,
  payment_terms INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(64),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_name ON suppliers(supplier_name);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- コメント追加
COMMENT ON TABLE suppliers IS '仕入先マスタ';
COMMENT ON COLUMN suppliers.id IS '仕入先ID（主キー）';
COMMENT ON COLUMN suppliers.supplier_code IS '仕入先コード（一意）';
COMMENT ON COLUMN suppliers.supplier_name IS '仕入先名';
COMMENT ON COLUMN suppliers.payment_terms IS '支払条件（日数）';
COMMENT ON COLUMN suppliers.is_active IS 'アクティブフラグ';
COMMENT ON COLUMN suppliers.contact_person IS '担当者名';
COMMENT ON COLUMN suppliers.contact_email IS '連絡先メール';
COMMENT ON COLUMN suppliers.contact_phone IS '連絡先電話番号';
COMMENT ON COLUMN suppliers.address IS '住所';
COMMENT ON COLUMN suppliers.notes IS 'メモ';
