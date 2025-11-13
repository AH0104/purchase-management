export function normalizeNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "").replace(/円$/, "");
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function normalizeDate(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) return trimmed;
    if (/^\d{8}$/.test(trimmed)) {
      const year = trimmed.slice(0, 4);
      const month = trimmed.slice(4, 6);
      const day = trimmed.slice(6, 8);
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}[/.]\d{1,2}[/.]\d{1,2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split(/[/.]/).map((part) => part.padStart(2, "0"));
      return `${year}-${month}-${day}`;
    }
    if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(trimmed)) {
      const match = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
      if (match) {
        const [, y, m, d] = match;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    if (/^(\d{2})[./](\d{2})[./](\d{2})$/.test(trimmed)) {
      const [, y, m, d] = trimmed.match(/^(\d{2})[./](\d{2})[./](\d{2})$/)!;
      const year = Number(y) + 2000;
      return `${year}-${m}-${d}`;
    }
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return "";
}

export function findRowIndex(rows: unknown[][], keyword: string): number {
  return rows.findIndex((row) =>
    row.some((cell) => typeof cell === "string" && cell.includes(keyword))
  );
}

// テンプレートに基づいてExcel行からデータを抽出
export function extractExcelRowData(
  row: unknown[],
  columnMapping: Record<string, { column: string; header_name?: string }>,
  excelColumnToIndex: (col: string) => number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [field, config] of Object.entries(columnMapping)) {
    const colIndex = excelColumnToIndex(config.column);
    result[field] = row[colIndex] ?? "";
  }
  return result;
}

// テンプレートに基づいてCSV行からデータを抽出
export function extractCsvRowData(
  row: Record<string, string>,
  columnMapping: Record<string, { column: string; header_name?: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [field, config] of Object.entries(columnMapping)) {
    result[field] = row[config.column] ?? "";
  }
  return result;
}


