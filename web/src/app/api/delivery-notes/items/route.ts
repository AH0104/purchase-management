import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

type RawItem = {
  id: number;
  delivery_note_id: number;
  delivery_note_number: string | null;
  delivery_date: string | null;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
  delivery_notes: {
    id: number;
    supplier_id: number | null;
    delivery_date: string | null;
    status: "pending" | "reconciled" | "paid";
    original_file_name: string;
    file_type: string;
    suppliers?: {
      supplier_name: string | null;
    } | null;
  } | null;
};


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get("productCode");
    const supplierId = searchParams.get("supplierId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    if (!productCode || !productCode.trim()) {
      return NextResponse.json({ error: "商品コードを指定してください" }, { status: 400 });
    }

    let query = supabase
      .from("delivery_note_items")
      .select(
        `
        id,
        delivery_note_id,
        delivery_note_number,
        delivery_date,
        product_code,
        product_name,
        quantity,
        unit_price,
        amount,
        remarks,
        delivery_notes!inner (
          id,
          supplier_id,
          delivery_date,
          status,
          original_file_name,
          file_type,
          suppliers:supplier_id (
            supplier_name
          )
        )
      `
      )
      .ilike("product_code", `%${productCode}%`)
      .order("delivery_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (supplierId) {
      query = query.eq("delivery_notes.supplier_id", parseInt(supplierId, 10));
    }
    if (startDate) {
      query = query.gte("delivery_date", startDate);
    }
    if (endDate) {
      query = query.lte("delivery_date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as unknown as RawItem[];

    // 商品コードから部門名を取得（smaregi_products に直接保存されている）
    const productCodes = Array.from(new Set(rows.map((item) => item.product_code).filter(Boolean)));
    let departmentMap = new Map<string, string>(); // product_code -> department_name

    if (productCodes.length > 0) {
      const { data: productMappings } = await supabase
        .from("smaregi_products")
        .select("product_code, department_name")
        .in("product_code", productCodes);

      (productMappings ?? []).forEach((mapping: any) => {
        if (mapping.department_name) {
          departmentMap.set(mapping.product_code, mapping.department_name);
        }
      });
    }

    const records = rows.map((item) => {
      const note = item.delivery_notes;
      const supplierName = note?.suppliers?.supplier_name ?? null;
      const departmentName = departmentMap.get(item.product_code) || null;
      return {
        id: item.id,
        deliveryNoteId: item.delivery_note_id,
        deliveryNoteNumber: item.delivery_note_number,
        deliveryDate: item.delivery_date || note?.delivery_date || null,
        supplierId: note?.supplier_id ?? null,
        supplierName,
        productCode: item.product_code,
        productName: item.product_name,
        departmentName,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
        originalFileName: note?.original_file_name ?? "",
        remarks: item.remarks,
        status: note?.status ?? "pending",
        fileType: note?.file_type ?? "",
      };
    });

    records.sort((a, b) => {
      const dateA = a.deliveryDate || "";
      const dateB = b.deliveryDate || "";
      if (dateA === dateB) {
        return a.id < b.id ? 1 : -1;
      }
      return dateA < dateB ? 1 : -1;
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "商品コード検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

