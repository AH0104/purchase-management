import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { z } from "zod";

export const runtime = "nodejs";

const supplierSchema = z.object({
  supplier_code: z.string().min(1),
  supplier_name: z.string().min(1),
  payment_terms: z.number().int().nullable(),
  is_active: z.boolean(),
  contact_person: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
});

// GET: 仕入先一覧取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");
    const isActive = searchParams.get("isActive");

    let query = supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .order("supplier_name", { ascending: true });

    if (keyword) {
      query = query.or(
        `supplier_name.ilike.*${keyword}*,supplier_code.ilike.*${keyword}*`
      );
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: 仕入先新規登録
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supplierSchema.parse(body);

    // コードの重複チェック
    const { data: existing, error: checkError } = await supabase
      .from("suppliers")
      .select("id")
      .eq("supplier_code", parsed.supplier_code)
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

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        supplier_code: parsed.supplier_code,
        supplier_name: parsed.supplier_name,
        payment_terms: parsed.payment_terms,
        is_active: parsed.is_active,
        contact_person: parsed.contact_person || null,
        contact_email: parsed.contact_email || null,
      })
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
    const message = error instanceof Error ? error.message : "登録処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

