import Papa from "papaparse";
import { DeliveryNoteItemInput, UploadParseResult } from "@/types/delivery";
import { normalizeNumber, extractCsvRowData, normalizeDate } from "./utils";
import { FileFormatTemplate } from "@/types/file-format";

type CsvParseOptions = {
  file: File;
  supplierId: number;
  template?: FileFormatTemplate;
};

// 複数のエンコーディングを試行してテキストを取得
async function decodeCsvFile(arrayBuffer: ArrayBuffer): Promise<string> {
  const encodings = ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp"];
  
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      let text = decoder.decode(arrayBuffer);
      
      // BOMを除去
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      
      // 文字化けチェック: 制御文字（改行・タブ以外）が多すぎる場合は別のエンコーディングを試す
      const controlCharCount = (text.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g) || []).length;
      if (controlCharCount > text.length * 0.1) {
        continue;
      }
      
      return text;
    } catch {
      continue;
    }
  }
  
  // すべて失敗した場合はUTF-8で強制的にデコード（fatal: false）
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = decoder.decode(arrayBuffer);
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

export async function parseCsvFile({ file, supplierId, template }: CsvParseOptions): Promise<UploadParseResult> {
  // 文字エンコーディングを複数試行してデコード
  const arrayBuffer = await file.arrayBuffer();
  const text = await decodeCsvFile(arrayBuffer);
  
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const items: DeliveryNoteItemInput[] = [];
  const warnings: string[] = [];

  if (result.errors.length > 0) {
    warnings.push("CSV の解析でエラーが発生しました");
  }

  // テンプレートがある場合はテンプレートを使用
  if (template) {
    const columnMapping = template.column_mapping;

    // 必須項目のチェック
    if (!columnMapping.product_code || !columnMapping.product_name) {
      warnings.push("商品コードまたは商品名のマッピングが設定されていません");
    }

    result.data.forEach((row, index) => {
      const rowData = extractCsvRowData(row, columnMapping);
      const productCode = String(rowData.product_code ?? "").trim();
      const productName = String(rowData.product_name ?? "").trim();

      if (!productCode || !productName) return;

      const quantity = normalizeNumber(rowData.quantity);
      const unitPrice = normalizeNumber(rowData.unit_price);
      const amount = normalizeNumber(rowData.amount ?? quantity * unitPrice);
      const deliveryDate = rowData.delivery_date ? normalizeDate(rowData.delivery_date) : "";
      const deliveryNoteNumber = rowData.delivery_note_number
        ? String(rowData.delivery_note_number).trim()
        : undefined;
      const remarks = rowData.remarks ? String(rowData.remarks).trim() : undefined;

      items.push({
        lineNumber: index + 1,
        deliveryDate: deliveryDate || undefined,
        deliveryNoteNumber,
        productCode,
        productName,
        quantity,
        unitPrice,
        amount,
        remarks,
      });
    });
  } else {
    // 従来の自動検出ロジック
    result.data.forEach((row, index) => {
      const productCode = row["商品コード"] || row["product_code"] || row["code"];
      const productName = row["商品名"] || row["product_name"] || row["name"];
      if (!productCode || !productName) return;

      const quantity = normalizeNumber(row["数量"] ?? row["quantity"]);
      const unitPrice = normalizeNumber(row["単価"] ?? row["unit_price"]);
      const amount = normalizeNumber(row["金額"] ?? row["amount"] ?? quantity * unitPrice);
      const deliveryDate = normalizeDate(
        row["納品日"] ??
          row["delivery_date"] ??
          row["納品日付"] ??
          row["date"]
      );
      const deliveryNoteNumber = row["納品書番号"] || row["delivery_note_number"] || row["伝票番号"] || undefined;
      const remarks = row["備考"] || row["remarks"] || row["備考欄"] || undefined;

      items.push({
        lineNumber: index + 1,
        deliveryDate: deliveryDate || undefined,
        deliveryNoteNumber,
        productCode,
        productName,
        quantity,
        unitPrice,
        amount,
        remarks,
      });
    });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    deliveryNote: {
      supplierId,
      deliveryDate: "",
      totalAmount,
      originalFileName: file.name,
      fileType: "csv",
      items,
    },
    warnings,
    rawPayload: result.data,
  };
}


