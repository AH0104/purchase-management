import { NextResponse } from "next/server";
import { listDriveImportQueue } from "@/lib/drive/db";
import type { DriveImportStatus } from "@/types/drive";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const limitParam = searchParams.get("limit");

    const statuses: DriveImportStatus[] | undefined = statusParam
      ? (statusParam.split(",").filter(Boolean) as DriveImportStatus[])
      : undefined;

    const limit = limitParam ? Math.min(Number(limitParam), 200) : DEFAULT_LIMIT;

    const allItems = await listDriveImportQueue({
      limit: 500,
    });

    const counts = allItems.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {
        pending: 0,
        pending_supplier: 0,
        ready: 0,
        processing: 0,
        processed: 0,
        error: 0,
      } as Record<DriveImportStatus, number>
    );

    const filtered = statuses && statuses.length > 0
      ? allItems.filter((item) => statuses.includes(item.status))
      : allItems;

    const items = filtered.slice(0, limit);

    return NextResponse.json({
      data: items,
      counts,
    });
  } catch (error) {
    console.error("[drive/import-queue] GET error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive インポートキューの取得に失敗しました" },
      { status: 500 }
    );
  }
}


