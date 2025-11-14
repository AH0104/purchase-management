import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { z, ZodError } from "zod";

export const runtime = "nodejs";

// column_mappingのスキーマ定義
const columnMappingConfigSchema = z.object({
  column: z.string(),
  header_name: z.string().optional(),
});

const templateSchema = z.object({
  supplier_id: z.number().int().min(1),
  file_type: z.enum(["excel", "csv"]),
  // z.record()は2つの引数（キースキーマ、値スキーマ）を取る
  column_mapping: z.record(z.string(), columnMappingConfigSchema),
  header_row_index: z.number().int().min(0),
  data_start_row_index: z.number().int().min(0),
});

// GET: テンプレート取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    const fileType = searchParams.get("fileType");

    let query = supabase.from("file_format_templates").select("*");

    if (supplierId) {
      query = query.eq("supplier_id", parseInt(supplierId));
    }
    if (fileType) {
      query = query.eq("file_type", fileType);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: テンプレート保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("受信したリクエストボディ:", JSON.stringify(body, null, 2));
    
    // バリデーション前に型変換を試行
    const normalizedBody = {
      supplier_id: typeof body.supplier_id === "string" ? parseInt(body.supplier_id) : body.supplier_id,
      file_type: body.file_type,
      column_mapping: body.column_mapping,
      header_row_index: typeof body.header_row_index === "string" ? parseInt(body.header_row_index) : body.header_row_index,
      data_start_row_index: typeof body.data_start_row_index === "string" ? parseInt(body.data_start_row_index) : body.data_start_row_index,
    };
    
    const parsed = templateSchema.parse(normalizedBody);

    // 既存のテンプレートをチェック（同じ仕入先・ファイル形式）
    // maybeSingle()を使用して、結果が0件でもエラーにならないようにする
    const { data: existing, error: checkError } = await supabase
      .from("file_format_templates")
      .select("id")
      .eq("supplier_id", parsed.supplier_id)
      .eq("file_type", parsed.file_type)
      .maybeSingle();

    if (checkError) {
      console.error("テンプレートチェックエラー:", checkError);
      throw checkError;
    }

    if (existing) {
      // 既存の場合は更新
      const { data, error } = await supabase
        .from("file_format_templates")
        .update({
          column_mapping: parsed.column_mapping,
          header_row_index: parsed.header_row_index,
          data_start_row_index: parsed.data_start_row_index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("テンプレート更新エラー:", error);
        throw error;
      }
      return NextResponse.json(data);
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from("file_format_templates")
        .insert({
          supplier_id: parsed.supplier_id,
          file_type: parsed.file_type,
          column_mapping: parsed.column_mapping,
          header_row_index: parsed.header_row_index,
          data_start_row_index: parsed.data_start_row_index,
        })
        .select()
        .single();

      if (error) {
        console.error("テンプレート作成エラー:", error);
        throw error;
      }
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("テンプレート保存エラー:", error);
    console.error("エラーの型:", error?.constructor?.name);
    console.error("エラーの詳細:", JSON.stringify(error, null, 2));
    
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: "入力データが不正です",
        details: error.issues,
      }, { status: 400 });
    }
    
    const message = error instanceof Error ? error.message : "保存処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

