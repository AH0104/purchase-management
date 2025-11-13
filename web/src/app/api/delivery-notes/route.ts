import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { saveDeliveryNote } from "@/lib/deliveryNotes/save";

export const runtime = "nodejs";

// GET: 納品書一覧取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");
    const keyword = searchParams.get("keyword");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("delivery_notes")
      .select(
        `
        *,
        suppliers:supplier_id (
          supplier_name
        )
      `,
        { count: "exact" }
      )
      .order("delivery_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte("delivery_date", startDate);
    }
    if (endDate) {
      query = query.lte("delivery_date", endDate);
    }
    if (supplierId) {
      query = query.eq("supplier_id", parseInt(supplierId));
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (keyword) {
      query = query.or(
        `original_file_name.ilike.*${keyword}*,delivery_note_number.ilike.*${keyword}*`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // suppliers の join 結果を flatten
    const flattened = (data || []).map((note: any) => ({
      ...note,
      supplier_name: note.suppliers?.supplier_name || null,
      suppliers: undefined,
    }));

    return NextResponse.json({
      data: flattened,
      count: count || 0,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await saveDeliveryNote(body.deliveryNote);

    return NextResponse.json({ id: result.id });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "保存処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


