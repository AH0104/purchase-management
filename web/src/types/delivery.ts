export type DeliveryNoteItemInput = {
  lineNumber: number;
  deliveryDate?: string; // 明細行ごとの納品日
  deliveryNoteNumber?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  remarks?: string;
};

export type DeliveryNoteInput = {
  supplierId: number;
  supplierName?: string;
  deliveryDate: string;
  totalAmount: number;
  originalFileName: string;
  fileType: string;
  items: DeliveryNoteItemInput[];
};

export type UploadParseResult = {
  deliveryNote: DeliveryNoteInput;
  warnings: string[];
  rawPayload?: unknown;
};

// データベースから取得する納品書の型
export type DeliveryNote = {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  delivery_date: string;
  delivery_note_number: string | null;
  total_amount: number;
  tax_amount: number;
  status: "pending" | "reconciled" | "paid";
  payment_due_date: string | null;
  original_file_name: string;
  file_type: string;
  created_at: string;
  updated_at: string;
};

export type DeliveryNoteItem = {
  id: number;
  delivery_note_id: number;
  line_number: number;
  delivery_date: string | null; // 明細行ごとの納品日
  delivery_note_number: string | null;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  tax_rate: number;
  tax_amount: number | null;
  remarks: string | null;
};

export type DeliveryNoteWithItems = DeliveryNote & {
  items: DeliveryNoteItem[];
};

export type DeliveryInvoiceSummary = {
  deliveryNoteId: number;
  deliveryNoteNumber: string | null;
  deliveryDate: string | null;
  supplierId: number | null;
  supplierName: string | null;
  status: DeliveryNote["status"];
  totalAmount: number;
  itemCount: number;
  originalFileName: string;
  updatedAt: string;
  fileType: string;
};

export type DeliveryItemRecord = {
  id: number;
  deliveryNoteId: number;
  deliveryNoteNumber: string | null;
  deliveryDate: string | null;
  supplierId: number | null;
  supplierName: string | null;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  originalFileName: string;
  remarks: string | null;
  status: DeliveryNote["status"];
  fileType: string;
};


