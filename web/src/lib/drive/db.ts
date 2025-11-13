import { supabase } from "@/lib/supabaseClient";
import {
  DriveImportQueueItem,
  DriveImportStatus,
  DriveQueueUpsertPayload,
  DriveSyncState,
} from "@/types/drive";

const QUEUE_TABLE = "drive_import_queue";
const SYNC_STATE_TABLE = "drive_sync_state";

export async function fetchDriveSyncState(): Promise<DriveSyncState | null> {
  const { data, error } = await supabase
    .from(SYNC_STATE_TABLE)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Drive sync state fetch error", error);
    throw error;
  }

  return data;
}

export async function upsertDriveSyncState(payload: {
  watchFolderId: string;
  pageToken?: string | null;
  startPageToken?: string | null;
  lastSyncedAt?: string | null;
}): Promise<void> {
  const { error } = await supabase.from(SYNC_STATE_TABLE).upsert(
    {
      id: 1,
      watch_folder_id: payload.watchFolderId,
      page_token: payload.pageToken ?? null,
      start_page_token: payload.startPageToken ?? null,
      last_synced_at: payload.lastSyncedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Drive sync state upsert error", error);
    throw error;
  }
}

export async function upsertDriveQueueItem(payload: DriveQueueUpsertPayload): Promise<DriveImportQueueItem | null> {
  const { data, error } = await supabase
    .from(QUEUE_TABLE)
    .upsert(
      {
        file_id: payload.fileId,
        file_name: payload.fileName,
        mime_type: payload.mimeType ?? null,
        md5_checksum: payload.md5Checksum ?? null,
        supplier_id: payload.supplierId ?? null,
        inferred_supplier_code: payload.inferredSupplierCode ?? null,
        inferred_supplier_name: payload.inferredSupplierName ?? null,
        source_folder_id: payload.sourceFolderId ?? null,
        source_folder_name: payload.sourceFolderName ?? null,
        source_path: payload.sourcePath ?? null,
        web_view_link: payload.webViewLink ?? null,
        size: payload.size ?? null,
        drive_created_time: payload.driveCreatedTime ?? null,
        drive_modified_time: payload.driveModifiedTime ?? null,
        status: payload.status ?? "pending_supplier",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "file_id" }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("Drive queue upsert error", error);
    throw error;
  }

  return data;
}

export async function listDriveImportQueue(params?: {
  status?: DriveImportStatus | DriveImportStatus[];
  limit?: number;
}): Promise<DriveImportQueueItem[]> {
  let query = supabase.from(QUEUE_TABLE).select("*").order("created_at", { ascending: false });

  if (params?.status) {
    if (Array.isArray(params.status)) {
      query = query.in("status", params.status);
    } else {
      query = query.eq("status", params.status);
    }
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Drive queue list error", error);
    throw error;
  }

  return data ?? [];
}

export async function fetchDriveQueueItem(id: number): Promise<DriveImportQueueItem | null> {
  const { data, error } = await supabase.from(QUEUE_TABLE).select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error("Drive queue fetch error", error);
    throw error;
  }

  return data;
}

export async function updateDriveQueueItem(
  id: number,
  payload: Partial<{
    status: DriveImportStatus;
    supplier_id: number | null;
    inferred_supplier_code: string | null;
    inferred_supplier_name: string | null;
    error_message: string | null;
    last_error_at: string | null;
    processed_at: string | null;
  }>
): Promise<void> {
  const { error } = await supabase
    .from(QUEUE_TABLE)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Drive queue update error", error);
    throw error;
  }
}


