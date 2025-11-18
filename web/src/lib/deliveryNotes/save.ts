import { supabase } from "@/lib/supabaseClient";
import { deliveryNoteSchema } from "@/lib/validators/delivery";
import type { DeliveryNoteInput } from "@/types/delivery";
import { syncNewProductDepartments } from "@/lib/smaregi/sync";

export type SaveDeliveryNoteResult = {
  id: number;
};

export async function saveDeliveryNote(deliveryNote: DeliveryNoteInput): Promise<SaveDeliveryNoteResult> {
  const parsed = deliveryNoteSchema.parse(deliveryNote);

  const firstItemDate = parsed.items.map((item) => item.deliveryDate).find((value) => Boolean(value));
  const headerDeliveryDate = (firstItemDate || parsed.deliveryDate || new Date().toISOString().slice(0, 10)) as string;

  const { data: noteInsert, error: noteError } = await supabase
    .from("delivery_notes")
    .insert({
      supplier_id: parsed.supplierId,
      delivery_date: headerDeliveryDate,
      delivery_note_number: null,
      total_amount: parsed.totalAmount,
      tax_amount: 0,
      status: "pending",
      payment_due_date: null,
      original_file_name: parsed.originalFileName,
      file_type: parsed.fileType,
    })
    .select("id")
    .single();

  if (noteError || !noteInsert) {
    throw noteError ?? new Error("納品書の登録に失敗しました");
  }

  const itemsPayload = parsed.items.map((item) => ({
    delivery_note_id: noteInsert.id,
    line_number: item.lineNumber,
    delivery_date: item.deliveryDate || null,
    delivery_note_number: item.deliveryNoteNumber || null,
    product_code: item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit: "",
    unit_price: item.unitPrice,
    amount: item.amount,
    tax_rate: 0,
    tax_amount: null,
    remarks: item.remarks || null,
  }));

  const { error: itemsError } = await supabase.from("delivery_note_items").insert(itemsPayload);

  if (itemsError) {
    await supabase.from("delivery_notes").delete().eq("id", noteInsert.id);
    throw itemsError;
  }

  // 納品データ保存後、新規商品コードの部門情報を自動同期（バックグラウンド処理）
  const productCodes = parsed.items
    .map((item) => item.productCode)
    .filter((code): code is string => typeof code === "string" && code.trim() !== "");

  if (productCodes.length > 0) {
    // エラーが発生しても納品データ保存は成功させる
    syncNewProductDepartments(productCodes).catch((error) => {
      console.error("[saveDeliveryNote] Failed to sync product departments:", error);
    });
  }

  return { id: noteInsert.id };
}


