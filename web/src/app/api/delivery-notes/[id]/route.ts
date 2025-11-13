import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// GET: 納品書詳細取得（明細含む）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = parseInt(id);

    if (isNaN(noteId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // 納品書ヘッダー取得
    const { data: note, error: noteError } = await supabase
      .from("delivery_notes")
      .select(
        `
        *,
        suppliers:supplier_id (
          supplier_name
        )
      `
      )
      .eq("id", noteId)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: "納品書が見つかりません" }, { status: 404 });
    }

    // 明細取得
    const { data: items, error: itemsError } = await supabase
      .from("delivery_note_items")
      .select("*")
      .eq("delivery_note_id", noteId)
      .order("line_number", { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    const result = {
      ...note,
      supplier_name: (note as any).suppliers?.supplier_name || null,
      suppliers: undefined,
      items: items || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}







