import { NextResponse } from "next/server";
import { getDriveClient, getDriveFolders, ensureStartPageToken, buildFilePath, inferSupplierFromPath } from "@/lib/google/drive";
import { fetchDriveSyncState, listDriveImportQueue, upsertDriveQueueItem, upsertDriveSyncState } from "@/lib/drive/db";
import { supabase } from "@/lib/supabaseClient";
import type { DriveImportStatus } from "@/types/drive";

export const runtime = "nodejs";

type SupplierCandidate = {
  id: number;
  supplier_code: string | null;
  supplier_name: string;
};

export async function POST() {
  try {
    const drive = await getDriveClient();
    const { watchFolderId } = await getDriveFolders();

    const { data: suppliers, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, supplier_code, supplier_name")
      .eq("is_active", true);

    if (supplierError) {
      throw supplierError;
    }

    const supplierCandidates: SupplierCandidate[] = suppliers ?? [];

    const syncState = await fetchDriveSyncState();
    let startPageToken = syncState?.start_page_token ?? null;
    let pageToken = syncState?.page_token ?? null;

    if (!startPageToken) {
      startPageToken = await ensureStartPageToken(drive);
    }

    if (!pageToken) {
      pageToken = startPageToken;
    }

    if (!pageToken) {
      throw new Error("Drive Sync の pageToken を確定できませんでした");
    }

    const processed: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ fileId: string; reason: string }> = [];

    let nextPageToken: string | undefined;
    let newStartPageToken: string | undefined;

    do {
      const response = await drive.changes.list({
        pageToken,
        fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,md5Checksum,webViewLink,size,createdTime,modifiedTime))",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        restrictToMyDrive: true,
        spaces: "drive",
        pageSize: 100,
      });
      const responseData = response.data;

      nextPageToken = responseData.nextPageToken ?? undefined;
      newStartPageToken = responseData.newStartPageToken ?? undefined;

      const changes = responseData.changes ?? [];
      for (const change of changes) {
        if (!change.fileId) continue;

        if (change.removed) {
          skipped.push(change.fileId);
          continue;
        }

        const file = change.file;
        if (!file || !file.id || !file.name) {
          errors.push({ fileId: change.fileId, reason: "ファイル情報が不足しています" });
          continue;
        }

        const { segments, parentFolderId, parentFolderName, isUnderWatchFolder } = await buildFilePath(
          drive,
          file,
          watchFolderId
        );

        if (!isUnderWatchFolder) {
          skipped.push(file.id);
          continue;
        }
        const supplierMatch = inferSupplierFromPath(segments, file.name, supplierCandidates);
        const status: DriveImportStatus = supplierMatch.supplierId ? "pending" : "pending_supplier";
        const sourcePath = segments.map((segment) => segment.name).join(" / ");

        try {
          await upsertDriveQueueItem({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType ?? null,
            md5Checksum: file.md5Checksum ?? null,
            supplierId: supplierMatch.supplierId,
            inferredSupplierCode: supplierMatch.inferredCode,
            inferredSupplierName: supplierMatch.inferredName,
            sourceFolderId: parentFolderId,
            sourceFolderName: parentFolderName,
            sourcePath: sourcePath || null,
            webViewLink: file.webViewLink ?? null,
            size: file.size ? Number(file.size) : null,
            driveCreatedTime: file.createdTime ?? null,
            driveModifiedTime: file.modifiedTime ?? null,
            status,
          });
          processed.push(file.id);
        } catch (error) {
          console.error("Queue upsert failed", error);
          errors.push({ fileId: file.id, reason: error instanceof Error ? error.message : "不明なエラー" });
        }
      }

      pageToken = nextPageToken;
    } while (nextPageToken);

    const finalPageToken = nextPageToken ?? pageToken ?? startPageToken ?? null;
    await upsertDriveSyncState({
      watchFolderId,
      pageToken: finalPageToken,
      startPageToken: newStartPageToken ?? startPageToken ?? null,
    });

    const queueSnapshot = await listDriveImportQueue({ limit: 10 });

    return NextResponse.json({
      status: "ok",
      processedCount: processed.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      processed,
      skipped,
      errors,
      latestQueueSample: queueSnapshot,
    });
  } catch (error) {
    console.error("[drive/poll] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive ポーリングでエラーが発生しました" },
      { status: 500 }
    );
  }
}


