"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnMappingField, SYSTEM_FIELDS, excelIndexToColumn, excelColumnToIndex, FileFormatTemplateInput } from "@/types/file-format";
import { toast } from "sonner";

type ColumnMappingDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (mapping: FileFormatTemplateInput, saveAsTemplate: boolean) => void;
  fileType: "excel" | "csv";
  supplierId: number;
  rawData: unknown; // Excel: unknown[][], CSV: Record<string, string>[]
};

export function ColumnMappingDialog({
  isOpen,
  onClose,
  onApply,
  fileType,
  supplierId,
  rawData,
}: ColumnMappingDialogProps) {
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [dataStartRowIndex, setDataStartRowIndex] = useState(1);
  const [mapping, setMapping] = useState<Partial<Record<ColumnMappingField, { column: string; header_name?: string }>>>({});
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);

  // Excel用: 行データを取得
  const rows = useMemo(() => {
    if (fileType === "excel") {
      return (rawData as unknown[][]) || [];
    }
    return [];
  }, [rawData, fileType]);

  // CSV用: ヘッダー行を取得
  const csvHeaders = useMemo(() => {
    if (fileType === "csv") {
      const data = (rawData as Record<string, string>[]) || [];
      if (data.length > 0) {
        return Object.keys(data[0]);
      }
    }
    return [];
  }, [rawData, fileType]);

  // ヘッダー行の選択肢（Excel用）
  const headerRowOptions = useMemo(() => {
    if (fileType === "excel") {
      return rows.slice(0, Math.min(10, rows.length)).map((_, index) => index);
    }
    return [];
  }, [rows, fileType]);

  // 現在のヘッダー行を取得
  const currentHeaderRow = useMemo(() => {
    if (fileType === "excel" && rows[headerRowIndex]) {
      return rows[headerRowIndex] as unknown[];
    }
    return [];
  }, [fileType, rows, headerRowIndex]);

  // 文字列を安全に表示するための関数
  const safeString = (str: unknown): string => {
    if (str === null || str === undefined) return "";
    const s = String(str);
    // 文字化けを防ぐため、不正な文字を除去
    try {
      // 制御文字（改行・タブ・復帰以外）を除去
      const cleaned = s.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
      return cleaned.trim();
    } catch {
      return s;
    }
  };

  // カラムオプション（Excel用: A, B, C... / CSV用: ヘッダー名）
  const columnOptions = useMemo(() => {
    if (fileType === "excel") {
      const maxCols = currentHeaderRow.length > 0 
        ? Math.max(...currentHeaderRow.map((_, i) => i), 0)
        : 0;
      return Array.from({ length: maxCols + 1 }, (_, i) => {
        const headerValue = safeString(currentHeaderRow[i]);
        return {
          value: excelIndexToColumn(i),
          label: `${excelIndexToColumn(i)}列: ${headerValue || "(空)"}`,
        };
      });
    } else {
      // CSV
      return csvHeaders.map((header) => ({
        value: header,
        label: safeString(header),
      }));
    }
  }, [fileType, currentHeaderRow, csvHeaders]);

  // データプレビュー（最初の3行）
  const previewData = useMemo(() => {
    if (fileType === "excel") {
      return rows.slice(dataStartRowIndex, dataStartRowIndex + 3);
    } else {
      const data = (rawData as Record<string, string>[]) || [];
      return data.slice(0, 3);
    }
  }, [fileType, rows, dataStartRowIndex, rawData]);

  // マッピングのバリデーション
  const isValid = useMemo(() => {
    return !!mapping.product_code && !!mapping.product_name;
  }, [mapping]);

  const handleMappingChange = (field: ColumnMappingField, column: string) => {
    const headerName = fileType === "excel"
      ? column
        ? String(currentHeaderRow[excelColumnToIndex(column)] || "").trim()
        : ""
      : column;
    
    setMapping((prev) => ({
      ...prev,
      [field]: { column, header_name: headerName },
    }));
  };

  const handleApply = () => {
    if (!isValid) {
      toast.error("商品コードと商品名のマッピングは必須です");
      return;
    }

    const templateInput: FileFormatTemplateInput = {
      supplier_id: supplierId,
      file_type: fileType,
      column_mapping: mapping as Record<ColumnMappingField, { column: string; header_name?: string }>,
      header_row_index: headerRowIndex,
      data_start_row_index: dataStartRowIndex,
    };

    onApply(templateInput, saveAsTemplate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">ファイル形式マッピング設定</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ヘッダー行の選択（Excel用） */}
          {fileType === "excel" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ヘッダー行の選択
              </label>
              <select
                value={headerRowIndex}
                onChange={(e) => {
                  const newIndex = parseInt(e.target.value);
                  setHeaderRowIndex(newIndex);
                  setDataStartRowIndex(newIndex + 1);
                }}
                className="h-10 border rounded px-3 w-full"
              >
                {headerRowOptions.map((index) => {
                  const firstCell = safeString(rows[index]?.[0] || "");
                  const displayText = firstCell.length > 30 ? firstCell.substring(0, 30) + "..." : firstCell;
                  return (
                    <option key={index} value={index}>
                      {index + 1}行目: {displayText || "(空)"}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                データ開始行: {dataStartRowIndex + 1}行目
              </p>
            </div>
          )}

          {/* カラムマッピングテーブル */}
          <div>
            <h3 className="text-lg font-semibold mb-4">カラムマッピング</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">システム項目</th>
                    <th className="text-left p-3">ファイルのカラム</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(SYSTEM_FIELDS) as ColumnMappingField[]).map((field) => {
                    const fieldInfo = SYSTEM_FIELDS[field];
                    const currentMapping = mapping[field];
                    return (
                      <tr key={field} className="border-t">
                        <td className="p-3">
                          {fieldInfo.label}
                          {fieldInfo.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="p-3">
                          <select
                            value={currentMapping?.column || ""}
                            onChange={(e) => handleMappingChange(field, e.target.value)}
                            className="h-9 w-full border rounded px-2"
                          >
                            <option value="">未選択</option>
                            {columnOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-500 p-3 bg-slate-50 border-t">
                * 必須項目
              </p>
            </div>
          </div>

          {/* データプレビュー */}
          <div>
            <h3 className="text-lg font-semibold mb-4">データプレビュー（最初の3行）</h3>
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2 border-r">商品コード</th>
                    <th className="text-left p-2 border-r">商品名</th>
                    <th className="text-left p-2 border-r">納品日</th>
                    <th className="text-right p-2 border-r">数量</th>
                    <th className="text-right p-2 border-r">単価</th>
                    <th className="text-right p-2 border-r">金額</th>
                    <th className="text-left p-2 border-r">納品書番号</th>
                    <th className="text-left p-2">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => {
                    const getValue = (field: ColumnMappingField) => {
                      const map = mapping[field];
                      if (!map?.column) return "-";
                      if (fileType === "excel") {
                        const colIndex = excelColumnToIndex(map.column);
                        return safeString((row as unknown[])[colIndex]) || "-";
                      } else {
                        return safeString((row as Record<string, string>)[map.column]) || "-";
                      }
                    };
                    return (
                      <tr key={index} className="border-t">
                        <td className="p-2 border-r">{getValue("product_code")}</td>
                        <td className="p-2 border-r">{getValue("product_name")}</td>
                        <td className="p-2 border-r">{getValue("delivery_date")}</td>
                        <td className="p-2 text-right border-r">{getValue("quantity")}</td>
                        <td className="p-2 text-right border-r">{getValue("unit_price")}</td>
                        <td className="p-2 text-right border-r">{getValue("amount")}</td>
                        <td className="p-2 border-r">{getValue("delivery_note_number")}</td>
                        <td className="p-2">{getValue("remarks")}</td>
                      </tr>
                    );
                  })}
                  {previewData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400">
                        プレビューデータがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* テンプレート保存チェックボックス */}
          <div className="flex items-center gap-2 p-4 bg-slate-50 rounded">
            <input
              type="checkbox"
              id="saveTemplate"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="saveTemplate" className="text-sm">
              このマッピングをテンプレートとして保存する
              <br />
              <span className="text-slate-500">
                （次回以降、この仕入先の同じ形式のファイルに自動適用されます）
              </span>
            </label>
          </div>

          {/* アクションボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded border hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleApply}
              disabled={!isValid}
              className="h-10 px-6 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              マッピングを適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

