-- delivery_notes テーブルを作成
-- 納品書ヘッダー情報

CREATE TABLE IF NOT EXISTS delivery_notes (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  delivery_note_number VARCHAR(255),
  total_amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'paid')),
  reconciled_at TIMESTAMPTZ,
  reconciled_by INTEGER,
  reconciliation_notes TEXT,
  payment_due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_by INTEGER,
  original_file_path VARCHAR(512),
  original_file_name VARCHAR(255),
  file_type VARCHAR(50),
  uploaded_by INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_delivery_notes_supplier_id ON delivery_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_delivery_date ON delivery_notes(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_created_at ON delivery_notes(created_at DESC);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_delivery_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_notes_updated_at
  BEFORE UPDATE ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_notes_updated_at();

-- コメント追加
COMMENT ON TABLE delivery_notes IS '納品書ヘッダー';
COMMENT ON COLUMN delivery_notes.supplier_id IS '仕入先ID';
COMMENT ON COLUMN delivery_notes.delivery_date IS '納品日';
COMMENT ON COLUMN delivery_notes.delivery_note_number IS '納品書番号';
COMMENT ON COLUMN delivery_notes.total_amount IS '合計金額（税抜き）';
COMMENT ON COLUMN delivery_notes.tax_amount IS '税額';
COMMENT ON COLUMN delivery_notes.status IS 'ステータス（pending/reconciled/paid）';

-- delivery_note_items テーブルを作成
-- 納品書明細

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  line_number INTEGER,
  delivery_date DATE,
  delivery_note_number VARCHAR(255),
  product_code VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit VARCHAR(50) DEFAULT '個',
  unit_price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 10.00,
  tax_amount NUMERIC,
  smaregi_product_id VARCHAR(128),
  smaregi_synced_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_product_code ON delivery_note_items(product_code);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_date ON delivery_note_items(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_number ON delivery_note_items(delivery_note_number);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_delivery_note_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_note_items_updated_at
  BEFORE UPDATE ON delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_note_items_updated_at();

-- コメント追加
COMMENT ON TABLE delivery_note_items IS '納品書明細';
COMMENT ON COLUMN delivery_note_items.delivery_note_id IS '納品書ID';
COMMENT ON COLUMN delivery_note_items.line_number IS '行番号';
COMMENT ON COLUMN delivery_note_items.delivery_date IS '明細行ごとの納品日';
COMMENT ON COLUMN delivery_note_items.delivery_note_number IS '明細行ごとの納品書番号';
COMMENT ON COLUMN delivery_note_items.product_code IS '商品コード';
COMMENT ON COLUMN delivery_note_items.product_name IS '商品名';
COMMENT ON COLUMN delivery_note_items.quantity IS '数量';
COMMENT ON COLUMN delivery_note_items.unit IS '単位';
COMMENT ON COLUMN delivery_note_items.unit_price IS '単価';
COMMENT ON COLUMN delivery_note_items.amount IS '金額';
