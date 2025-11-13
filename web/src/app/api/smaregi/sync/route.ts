import { NextResponse } from "next/server";
import { syncSmaregi } from "@/lib/smaregi/sync";

export const runtime = "nodejs";

function checkAuth(request: Request) {
  const secret = process.env.SMAREGI_SYNC_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-cron-secret") ?? request.headers.get("authorization");
  if (!header) return false;
  if (header === secret) return true;
  if (header.startsWith("Bearer ")) {
    return header.substring(7) === secret;
  }
  return false;
}

async function handleSync() {
  const summary = await syncSmaregi();
  return NextResponse.json({ ok: true, summary });
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await handleSync();
  } catch (error) {
    console.error("Smaregi sync failed", error);
    const message = error instanceof Error ? error.message : "同期に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await handleSync();
  } catch (error) {
    console.error("Smaregi sync failed", error);
    const message = error instanceof Error ? error.message : "同期に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
