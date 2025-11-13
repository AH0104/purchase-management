export type DriveImportStatus =
  | "pending"
  | "pending_supplier"
  | "ready"
  | "processing"
  | "processed"
  | "error";

export type DriveImportQueueItem = {
  id: number;
  file_id: string;
  file_name: string;
  mime_type: string | null;
  md5_checksum: string | null;
  supplier_id: number | null;
  inferred_supplier_code: string | null;
  inferred_supplier_name: string | null;
  source_folder_id: string | null;
  source_folder_name: string | null;
  source_path: string | null;
  web_view_link: string | null;
  size: number | null;
  drive_created_time: string | null;
  drive_modified_time: string | null;
  status: DriveImportStatus;
  error_message: string | null;
  last_error_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DriveSyncState = {
  id: number;
  watch_folder_id: string;
  page_token: string | null;
  start_page_token: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DriveQueueUpsertPayload = {
  fileId: string;
  fileName: string;
  mimeType?: string | null;
  md5Checksum?: string | null;
  supplierId?: number | null;
  inferredSupplierCode?: string | null;
  inferredSupplierName?: string | null;
  sourceFolderId?: string | null;
  sourceFolderName?: string | null;
  sourcePath?: string | null;
  webViewLink?: string | null;
  size?: number | null;
  driveCreatedTime?: string | null;
  driveModifiedTime?: string | null;
  status?: DriveImportStatus;
};








