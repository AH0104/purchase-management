import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

type RawInvoiceItem = {
  id: number;
  delivery_note_id: number;
  delivery_note_number: string | null;
  delivery_date: string | null;
  amount: number;
  delivery_notes: {
    id: number;
    supplier_id: number | null;
    delivery_date: string | null;
    status: "pending" | "reconciled" | "paid";
    original_file_name: string;
    updated_at: string;
    file_type: string;
    suppliers?: {
      supplier_name: string | null;
    } | null;
  } | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");
    const keyword = searchParams.get("keyword");
    const limit = parseInt(searchParams.get("limit") || "200", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = supabase
      .from("delivery_note_items")
      .select(
        `
        id,
        delivery_note_id,
        delivery_note_number,
        delivery_date,
        amount,
        delivery_notes!inner (
          id,
          supplier_id,
          delivery_date,
          status,
          original_file_name,
          updated_at,
          file_type,
          suppliers:supplier_id (
            supplier_name
          )
        )
      `
      )
      .order("delivery_date", { ascending: false })
      .order("id", { ascending: false });

    if (startDate) {
      query = query.gte("delivery_date", startDate);
    }
    if (endDate) {
      query = query.lte("delivery_date", endDate);
    }
    if (supplierId) {
      query = query.eq("delivery_notes.supplier_id", parseInt(supplierId, 10));
    }
    if (status) {
      query = query.eq("delivery_notes.status", status);
    }
    if (keyword) {
      query = query.or(
        `delivery_note_number.ilike.*${keyword}*,delivery_notes.original_file_name.ilike.*${keyword}*`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const grouped = new Map<
      string,
      {
        deliveryNoteId: number;
        deliveryNoteNumber: string | null;
        supplierId: number | null;
        supplierName: string | null;
        status: "pending" | "reconciled" | "paid";
        totalAmount: number;
        itemCount: number;
        deliveryDates: string[];
        originalFileName: string;
        updatedAt: string;
        fileType: string;
      }
    >();

    const rows = (data ?? []) as unknown as RawInvoiceItem[];

    rows.forEach((item) => {
      const note = item.delivery_notes;
      if (!note) return;

      const key = `${note.id}__${item.delivery_note_number ?? "null"}`;
      const existing = grouped.get(key);
      const deliveryDate = item.delivery_date || note.delivery_date || null;
      const supplierName = note.suppliers?.supplier_name ?? null;

      if (existing) {
        existing.totalAmount += item.amount ?? 0;
        existing.itemCount += 1;
        if (deliveryDate) {
          existing.deliveryDates.push(deliveryDate);
        }
      } else {
        grouped.set(key, {
          deliveryNoteId: note.id,
          deliveryNoteNumber: item.delivery_note_number,
          supplierId: note.supplier_id,
          supplierName,
          status: note.status,
          totalAmount: item.amount ?? 0,
          itemCount: 1,
          deliveryDates: deliveryDate ? [deliveryDate] : [],
          originalFileName: note.original_file_name,
          updatedAt: note.updated_at,
          fileType: note.file_type,
        });
      }
    });

    const summaries = Array.from(grouped.values()).map((group) => {
      let selectedDate: string | null = null;
      if (group.deliveryDates.length > 0) {
        selectedDate = group.deliveryDates.sort((a, b) => (a < b ? 1 : -1))[0];
      }

      return {
        deliveryNoteId: group.deliveryNoteId,
        deliveryNoteNumber: group.deliveryNoteNumber,
        deliveryDate: selectedDate,
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        status: group.status,
        totalAmount: group.totalAmount,
        itemCount: group.itemCount,
        originalFileName: group.originalFileName,
        updatedAt: group.updatedAt,
        fileType: group.fileType,
      };
    });

    summaries.sort((a, b) => {
      const dateA = a.deliveryDate || "";
      const dateB = b.deliveryDate || "";
      if (dateA === dateB) {
        return a.updatedAt < b.updatedAt ? 1 : -1;
      }
      return dateA < dateB ? 1 : -1;
    });

    const totalCount = summaries.length;
    const paginated = summaries.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      count: totalCount,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "伝票データの取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

