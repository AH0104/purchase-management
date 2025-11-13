-- file_format_templates テーブルを作成
-- 仕入先ごとのファイル形式（Excel/CSV）のカラムマッピングテンプレートを保存

CREATE TABLE IF NOT EXISTS file_format_templates (
  id BIGSERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('excel', 'csv')),
  column_mapping JSONB NOT NULL,
  header_row_index INTEGER NOT NULL DEFAULT 0,
  data_start_row_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supplier_id, file_type)
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_file_format_templates_supplier_id ON file_format_templates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_file_format_templates_file_type ON file_format_templates(file_type);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_file_format_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_file_format_templates_updated_at
  BEFORE UPDATE ON file_format_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_file_format_templates_updated_at();

-- コメント追加
COMMENT ON TABLE file_format_templates IS 'ファイル形式マッピングテンプレート（仕入先ごとのExcel/CSVフォーマット設定）';
COMMENT ON COLUMN file_format_templates.supplier_id IS '仕入先ID';
COMMENT ON COLUMN file_format_templates.file_type IS 'ファイル形式（excel/csv）';
COMMENT ON COLUMN file_format_templates.column_mapping IS 'カラムマッピング設定（JSON形式）';
COMMENT ON COLUMN file_format_templates.header_row_index IS 'ヘッダー行のインデックス（0始まり）';
COMMENT ON COLUMN file_format_templates.data_start_row_index IS 'データ開始行のインデックス（0始まり）';







