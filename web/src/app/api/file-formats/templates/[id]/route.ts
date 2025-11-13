import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { z } from "zod";

export const runtime = "nodejs";

const columnMappingConfigSchema = z.object({
  column: z.string(),
  header_name: z.string().optional(),
});

const templateUpdateSchema = z.object({
  column_mapping: z.record(z.string(), columnMappingConfigSchema).optional(),
  header_row_index: z.number().int().min(0).optional(),
  data_start_row_index: z.number().int().min(0).optional(),
});

// GET: テンプレート詳細取得
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("file_format_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "取得処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: テンプレート更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = templateUpdateSchema.parse(body);

    const { data, error } = await supabase
      .from("file_format_templates")
      .update(parsed)
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力データが不正です", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "更新処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: テンプレート削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { error } = await supabase
      .from("file_format_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "削除しました" });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "削除処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

