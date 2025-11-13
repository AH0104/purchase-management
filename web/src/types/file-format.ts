// ファイル形式マッピング関連の型定義

export type ColumnMappingField =
  | "product_code"
  | "product_name"
  | "quantity"
  | "unit_price"
  | "amount"
  | "delivery_date"
  | "delivery_note_number"
  | "remarks";

export type ColumnMappingConfig = {
  column: string; // Excel: "A", "B", ... / CSV: カラム名
  header_name?: string; // ヘッダー名（参考用）
};

export type ColumnMapping = {
  [K in ColumnMappingField]?: ColumnMappingConfig;
};

export type FileFormatTemplate = {
  id: number;
  supplier_id: number;
  file_type: "excel" | "csv";
  column_mapping: ColumnMapping;
  header_row_index: number;
  data_start_row_index: number;
  created_at: string;
  updated_at: string;
};

export type FileFormatTemplateInput = {
  supplier_id: number;
  file_type: "excel" | "csv";
  column_mapping: ColumnMapping;
  header_row_index: number;
  data_start_row_index: number;
};

// Excel用: 列インデックス（0始まり）と列名（A, B, C...）の変換
export function excelColumnToIndex(column: string): number {
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - "A".charCodeAt(0) + 1);
  }
  return result - 1;
}

export function excelIndexToColumn(index: number): string {
  let result = "";
  index++;
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

// システム項目のラベル
export const SYSTEM_FIELDS: Record<ColumnMappingField, { label: string; required: boolean }> = {
  product_code: { label: "商品コード", required: true },
  product_name: { label: "商品名", required: true },
  quantity: { label: "数量", required: false },
  unit_price: { label: "単価", required: false },
  amount: { label: "金額", required: false },
  delivery_date: { label: "納品日", required: false },
  delivery_note_number: { label: "納品書番号", required: false },
  remarks: { label: "備考", required: false },
};

