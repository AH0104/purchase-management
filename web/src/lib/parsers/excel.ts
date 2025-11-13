import * as XLSX from "xlsx";
import { normalizeDate, normalizeNumber, findRowIndex, extractExcelRowData } from "./utils";
import { DeliveryNoteItemInput, UploadParseResult } from "@/types/delivery";
import { FileFormatTemplate, excelColumnToIndex } from "@/types/file-format";

type ExcelParseOptions = {
  file: File;
  supplierId: number;
  template?: FileFormatTemplate;
};

export async function parseExcelFile({
  file,
  supplierId,
  template,
}: ExcelParseOptions): Promise<UploadParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  const warnings: string[] = [];

  // テンプレートがある場合はテンプレートを使用
  if (template) {
    return parseExcelWithTemplate(rows, supplierId, file.name, template, warnings);
  }

  // 従来の自動検出ロジック
  const deliveryDateRowIndex = findRowIndex(rows, "納品日");
  const supplierRowIndex = findRowIndex(rows, "仕入先");
  const headerRowIndex = findRowIndex(rows, "商品コード");

  if (headerRowIndex === -1) {
    warnings.push("商品コード列を特定できませんでした");
  }

  const deliveryDate = deliveryDateRowIndex >= 0
    ? normalizeDate(rows[deliveryDateRowIndex][1])
    : "";
  const supplierName = supplierRowIndex >= 0
    ? String(rows[supplierRowIndex][1] ?? "")
    : undefined;

  const items: DeliveryNoteItemInput[] = [];
  if (headerRowIndex >= 0) {
    const headerRow = rows[headerRowIndex];
    const deliveryNoteNumberColIndex = headerRow.findIndex((cell) =>
      typeof cell === "string" && (cell.includes("納品書") || cell.includes("伝票"))
    );
    const remarksColIndex = headerRow.findIndex((cell) =>
      typeof cell === "string" && (cell.includes("備考") || cell.includes(" Remarks"))
    );
    const deliveryDateColIndex = headerRow.findIndex((cell) =>
      typeof cell === "string" && (cell.includes("納品日") || cell.toLowerCase().includes("date"))
    );

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const productCodeRaw = row[0];
      const productNameRaw = row[1];
      if (!productCodeRaw || !productNameRaw) break;

      const quantity = normalizeNumber(row[2]);
      const unitPrice = normalizeNumber(row[3]);
      const amount = normalizeNumber(row[4] || quantity * unitPrice);
      const deliveryNoteNumber = deliveryNoteNumberColIndex >= 0
        ? String(row[deliveryNoteNumberColIndex] ?? "").trim()
        : undefined;
      const remarks = remarksColIndex >= 0
        ? String(row[remarksColIndex] ?? "").trim()
        : undefined;
      const deliveryDateValue = deliveryDateColIndex >= 0 ? normalizeDate(row[deliveryDateColIndex]) : "";

      items.push({
        lineNumber: items.length + 1,
        deliveryDate: deliveryDateValue || undefined,
        deliveryNoteNumber,
        productCode: String(productCodeRaw).trim(),
        productName: String(productNameRaw).trim(),
        quantity,
        unitPrice,
        amount,
        remarks,
      });
    }
  }

  if (items.length === 0) {
    warnings.push("明細データが抽出できませんでした");
  }

  const totalRowIndex = findRowIndex(rows, "合計");
  const totalAmount = totalRowIndex >= 0
    ? normalizeNumber(rows[totalRowIndex][1])
    : items.reduce((sum, item) => sum + item.amount, 0);

  return {
    deliveryNote: {
      supplierId,
      supplierName,
      deliveryDate,
      totalAmount,
      originalFileName: file.name,
      fileType: "excel",
      items,
    },
    warnings,
    rawPayload: rows,
  };
}

// テンプレートを使用してExcelを解析
function parseExcelWithTemplate(
  rows: unknown[][],
  supplierId: number,
  fileName: string,
  template: FileFormatTemplate,
  warnings: string[]
): UploadParseResult {
  const headerRowIndex = template.header_row_index;
  const dataStartRowIndex = template.data_start_row_index;
  const columnMapping = template.column_mapping;

  if (headerRowIndex < 0 || headerRowIndex >= rows.length) {
    warnings.push("ヘッダー行が見つかりません");
    return {
      deliveryNote: {
        supplierId,
        deliveryDate: "",
        totalAmount: 0,
        originalFileName: fileName,
        fileType: "excel",
        items: [],
      },
      warnings,
      rawPayload: rows,
    };
  }

  const items: DeliveryNoteItemInput[] = [];
  const deliveryDateRowIndex = findRowIndex(rows, "納品日");
  const supplierRowIndex = findRowIndex(rows, "仕入先");

  const deliveryDate = deliveryDateRowIndex >= 0
    ? normalizeDate(rows[deliveryDateRowIndex][1])
    : "";
  const supplierName = supplierRowIndex >= 0
    ? String(rows[supplierRowIndex][1] ?? "")
    : undefined;

  // 必須項目のチェック
  if (!columnMapping.product_code || !columnMapping.product_name) {
    warnings.push("商品コードまたは商品名のマッピングが設定されていません");
  }

  for (let i = dataStartRowIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const rowData = extractExcelRowData(row, columnMapping, excelColumnToIndex);
    const productCode = String(rowData.product_code ?? "").trim();
    const productName = String(rowData.product_name ?? "").trim();

    if (!productCode || !productName) {
      // 空行の場合はスキップ
      if (i === dataStartRowIndex) {
        // 最初の行が空の場合は警告
        warnings.push("データ開始行が空です");
      }
      continue;
    }

    const quantity = normalizeNumber(rowData.quantity);
    const unitPrice = normalizeNumber(rowData.unit_price);
    const amount = normalizeNumber(rowData.amount ?? quantity * unitPrice);
    const deliveryNoteNumber = rowData.delivery_note_number
      ? String(rowData.delivery_note_number).trim()
      : undefined;
    const remarks = rowData.remarks ? String(rowData.remarks).trim() : undefined;
    const deliveryDate = rowData.delivery_date ? normalizeDate(rowData.delivery_date) : "";

    items.push({
      lineNumber: items.length + 1,
      deliveryDate: deliveryDate || undefined,
      deliveryNoteNumber,
      productCode,
      productName,
      quantity,
      unitPrice,
      amount,
      remarks,
    });
  }

  if (items.length === 0) {
    warnings.push("明細データが抽出できませんでした");
  }

  const totalRowIndex = findRowIndex(rows, "合計");
  const totalAmount = totalRowIndex >= 0
    ? normalizeNumber(rows[totalRowIndex][1])
    : items.reduce((sum, item) => sum + item.amount, 0);

  return {
    deliveryNote: {
      supplierId,
      supplierName,
      deliveryDate,
      totalAmount,
      originalFileName: fileName,
      fileType: "excel",
      items,
    },
    warnings,
    rawPayload: rows,
  };
}


