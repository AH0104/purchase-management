-- Google Drive 取り込み関連テーブル

CREATE TABLE IF NOT EXISTS drive_import_queue (
  id BIGSERIAL PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  md5_checksum TEXT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  inferred_supplier_code TEXT,
  inferred_supplier_name TEXT,
  source_folder_id TEXT,
  source_folder_name TEXT,
  source_path TEXT,
  web_view_link TEXT,
  size BIGINT,
  drive_created_time TIMESTAMPTZ,
  drive_modified_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_supplier' CHECK (status IN ('pending', 'pending_supplier', 'ready', 'processing', 'processed', 'error')),
  error_message TEXT,
  last_error_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_import_queue_status ON drive_import_queue(status);
CREATE INDEX IF NOT EXISTS idx_drive_import_queue_supplier_id ON drive_import_queue(supplier_id);
CREATE INDEX IF NOT EXISTS idx_drive_import_queue_created_at ON drive_import_queue(created_at DESC);

CREATE OR REPLACE FUNCTION update_drive_import_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_drive_import_queue_updated_at ON drive_import_queue;
CREATE TRIGGER trigger_update_drive_import_queue_updated_at
  BEFORE UPDATE ON drive_import_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_drive_import_queue_updated_at();

COMMENT ON TABLE drive_import_queue IS 'Google Drive から取り込んだファイルの処理キュー';
COMMENT ON COLUMN drive_import_queue.file_id IS 'Drive ファイル ID';
COMMENT ON COLUMN drive_import_queue.source_path IS '監視フォルダからのパス（サブフォルダ含む）';
COMMENT ON COLUMN drive_import_queue.status IS '処理ステータス（pending / pending_supplier / ready / processing / processed / error）';

CREATE TABLE IF NOT EXISTS drive_sync_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  watch_folder_id TEXT NOT NULL,
  page_token TEXT,
  start_page_token TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_drive_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_drive_sync_state_updated_at ON drive_sync_state;
CREATE TRIGGER trigger_update_drive_sync_state_updated_at
  BEFORE UPDATE ON drive_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_drive_sync_state_updated_at();

COMMENT ON TABLE drive_sync_state IS 'Google Drive Changes API の同期トークン管理';
COMMENT ON COLUMN drive_sync_state.page_token IS '前回同期時のページトークン';
COMMENT ON COLUMN drive_sync_state.start_page_token IS '最新の startPageToken';








