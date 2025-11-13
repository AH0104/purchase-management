import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { z } from "zod";

export const runtime = "nodejs";

const supplierUpdateSchema = z.object({
  supplier_code: z.string().min(1).optional(),
  supplier_name: z.string().min(1).optional(),
  payment_terms: z.number().int().nullable().optional(),
  is_active: z.boolean().optional(),
  contact_person: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
});

// GET: 仕入先詳細取得
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplierId = parseInt(id);

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "仕入先が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: 仕入先更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplierId = parseInt(id);

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = supplierUpdateSchema.parse(body);

    // コードの重複チェック（自分以外）
    if (parsed.supplier_code) {
      const { data: existing, error: checkError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("supplier_code", parsed.supplier_code)
        .neq("id", supplierId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      if (existing) {
        return NextResponse.json(
          { error: "この仕入先コードは既に使用されています" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("suppliers")
      .update(parsed)
      .eq("id", supplierId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力データが不正です", details: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "更新処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: 仕入先削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplierId = parseInt(id);

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // 納品書が紐づいているかチェック
    const { count, error: checkError } = await supabase
      .from("delivery_notes")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", supplierId);

    if (checkError) throw checkError;

    if (count && count > 0) {
      // 納品書が存在する場合は論理削除（is_active = false）
      const { data, error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", supplierId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ ...data, deleted: false, message: "納品書が存在するため、非アクティブにしました" });
    } else {
      // 物理削除
      const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);

      if (error) throw error;
      return NextResponse.json({ deleted: true, message: "削除しました" });
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "削除処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}







