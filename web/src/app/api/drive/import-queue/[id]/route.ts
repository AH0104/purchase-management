import { NextRequest, NextResponse } from "next/server";
import { fetchDriveQueueItem, updateDriveQueueItem } from "@/lib/drive/db";
import { getDriveFolders, moveFileToFolder } from "@/lib/google/drive";
import type { DriveImportStatus } from "@/types/drive";

export const runtime = "nodejs";

type PatchBody = {
  status?: DriveImportStatus;
  supplierId?: number | null;
  inferredSupplierCode?: string | null;
  inferredSupplierName?: string | null;
  errorMessage?: string | null;
};

function extractId(params: { id?: string } | undefined, request: NextRequest): string | undefined {
  if (params?.id) return params.id;
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const index = segments.indexOf("import-queue");
  if (index >= 0 && segments.length > index + 1) {
    return segments[index + 1];
  }
  return undefined;
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  try {
    const rawId = extractId(context.params, request);
    if (!rawId) {
      return NextResponse.json({ error: "ID が指定されていません" }, { status: 400 });
    }
    const id = Number(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "ID が不正です", rawId }, { status: 400 });
    }

    const item = await fetchDriveQueueItem(id);
    if (!item) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("[drive/import-queue/:id] GET error", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  try {
    const rawId = extractId(context.params, request);
    if (!rawId) {
      return NextResponse.json({ error: "ID が指定されていません" }, { status: 400 });
    }
    const id = Number(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "ID が不正です", rawId }, { status: 400 });
    }

    const currentItem = await fetchDriveQueueItem(id);
    if (!currentItem) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    const body = (await request.json()) as PatchBody;
    const payload: Parameters<typeof updateDriveQueueItem>[1] = {};

    if (body.status) {
      payload.status = body.status;
    }
    if (body.supplierId !== undefined) {
      payload.supplier_id = body.supplierId === null ? null : body.supplierId;
    }
    if (body.inferredSupplierCode !== undefined) {
      payload.inferred_supplier_code = body.inferredSupplierCode;
    }
    if (body.inferredSupplierName !== undefined) {
      payload.inferred_supplier_name = body.inferredSupplierName;
    }
    if (body.errorMessage !== undefined) {
      payload.error_message = body.errorMessage;
      payload.last_error_at = body.errorMessage ? new Date().toISOString() : null;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    await updateDriveQueueItem(id, payload);

    if (body.status === "pending_supplier") {
      const { pendingFolderId } = await getDriveFolders();
      if (pendingFolderId) {
        try {
          await moveFileToFolder(currentItem.file_id, pendingFolderId);
        } catch (error) {
          console.warn("保留フォルダへの移動に失敗しました", error);
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[drive/import-queue/:id] PATCH error", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}


