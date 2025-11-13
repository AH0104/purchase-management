import { NextRequest, NextResponse } from "next/server";
import { downloadFile, getDriveFolders, moveFileToFolder } from "@/lib/google/drive";
import { fetchDriveQueueItem, updateDriveQueueItem } from "@/lib/drive/db";
import { parseExcelFile } from "@/lib/parsers/excel";
import { parseCsvFile } from "@/lib/parsers/csv";
import { parsePdfWithGemini } from "@/lib/parsers/pdf";
import { saveDeliveryNote } from "@/lib/deliveryNotes/save";
import { supabase } from "@/lib/supabaseClient";
import type { FileFormatTemplate } from "@/types/file-format";
import type { UploadParseResult } from "@/types/delivery";

export const runtime = "nodejs";

function detectFileType(fileName: string): "pdf" | "excel" | "csv" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}

async function fetchTemplate(
  supplierId: number,
  fileType: "excel" | "csv"
): Promise<FileFormatTemplate | null> {
  const { data, error } = await supabase
    .from("file_format_templates")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("file_type", fileType)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

type RouteParams = { id: string };

function isPromise<T>(value: unknown): value is Promise<T> {
  return typeof value === "object" && value !== null && typeof (value as Promise<T>).then === "function";
}

async function extractId(
  params: RouteParams | Promise<RouteParams> | undefined,
  request: NextRequest
): Promise<string | undefined> {
  if (params) {
    const resolved = isPromise<RouteParams>(params) ? await params : params;
    if (resolved?.id) return resolved.id;
  }
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const index = segments.indexOf("import-queue");
  if (index >= 0 && segments.length > index + 1) {
    return segments[index + 1];
  }
  return undefined;
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const rawId = await extractId(context.params, request);
  const id = Number(rawId ?? "");
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID が不正です", rawId: rawId ?? null }, { status: 400 });
  }

  try {
    const item = await fetchDriveQueueItem(id);
    if (!item) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    if (!item.supplier_id) {
      return NextResponse.json({ error: "仕入先が未確定のため処理できません" }, { status: 400 });
    }

    if (!["pending", "ready", "error"].includes(item.status)) {
      return NextResponse.json({ error: `現在のステータス (${item.status}) では処理できません` }, { status: 400 });
    }

    await updateDriveQueueItem(id, { status: "processing", error_message: null, last_error_at: null });

    const fileType = detectFileType(item.file_name);
    if (!fileType) {
      await updateDriveQueueItem(id, {
        status: "error",
        error_message: "対応していないファイル形式です",
        last_error_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: "対応していないファイル形式です" }, { status: 400 });
    }

    const buffer = await downloadFile(item.file_id);
    let result: UploadParseResult | null = null;

    if (fileType === "pdf") {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      result = await parsePdfWithGemini({
        buffer: arrayBuffer,
        supplierId: item.supplier_id,
        fileName: item.file_name,
      });
    } else {
      const template = await fetchTemplate(item.supplier_id, fileType);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const pseudoFile = {
        name: item.file_name,
        type: item.mime_type ?? undefined,
        arrayBuffer: async () => arrayBuffer,
      } as File;

      if (fileType === "excel") {
        result = await parseExcelFile({
          file: pseudoFile,
          supplierId: item.supplier_id,
          template: template ?? undefined,
        });
      } else if (fileType === "csv") {
        result = await parseCsvFile({
          file: pseudoFile,
          supplierId: item.supplier_id,
          template: template ?? undefined,
        });
      }
    }

    if (!result) {
      throw new Error("解析結果を取得できませんでした");
    }

    await saveDeliveryNote({
      ...result.deliveryNote,
      supplierId: item.supplier_id,
      originalFileName: item.file_name,
      fileType: fileType,
    });

    const { processedFolderId } = await getDriveFolders();
    if (processedFolderId) {
      try {
        await moveFileToFolder(item.file_id, processedFolderId);
      } catch (moveError) {
        console.warn("処理済みフォルダへの移動に失敗しました", moveError);
      }
    }

    await updateDriveQueueItem(id, {
      status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
      last_error_at: null,
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[drive/import-queue/:id/process] error", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object"
          ? JSON.stringify(error)
          : String(error ?? "処理中にエラーが発生しました");
    await updateDriveQueueItem(id, {
      status: "error",
      error_message: message,
      last_error_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


