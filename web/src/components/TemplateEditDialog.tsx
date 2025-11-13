"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ColumnMappingField,
  FileFormatTemplate,
  SYSTEM_FIELDS,
  ColumnMapping,
} from "@/types/file-format";

type TemplateEditDialogProps = {
  template: FileFormatTemplate;
  onClose: () => void;
  onUpdated: (template: FileFormatTemplate) => void;
};

type EditableMapping = Partial<Record<ColumnMappingField, { column: string; header_name?: string }>>;

const FIELD_ORDER: ColumnMappingField[] = [
  "product_code",
  "product_name",
  "delivery_date",
  "delivery_note_number",
  "quantity",
  "unit_price",
  "amount",
  "remarks",
];

export function TemplateEditDialog({ template, onClose, onUpdated }: TemplateEditDialogProps) {
  const [columnMapping, setColumnMapping] = useState<EditableMapping>({});
  const [headerRowIndex, setHeaderRowIndex] = useState(template.header_row_index);
  const [dataStartRowIndex, setDataStartRowIndex] = useState(template.data_start_row_index);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setColumnMapping(template.column_mapping as EditableMapping);
    setHeaderRowIndex(template.header_row_index);
    setDataStartRowIndex(template.data_start_row_index);
  }, [template]);

  const handleMappingChange = (field: ColumnMappingField, value: string) => {
    setColumnMapping((prev) => {
      if (!value.trim()) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [field]: {
          column: value.trim(),
          header_name: prev[field]?.header_name,
        },
      };
    });
  };

  const handleHeaderNameChange = (field: ColumnMappingField, value: string) => {
    setColumnMapping((prev) => {
      const existing = prev[field];
      if (!existing) {
        return prev;
      }
      if (!value.trim()) {
        const updated = { ...existing };
        delete updated.header_name;
        return {
          ...prev,
          [field]: updated,
        };
      }
      return {
        ...prev,
        [field]: {
          ...existing,
          header_name: value.trim(),
        },
      };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        column_mapping: columnMapping,
        header_row_index: headerRowIndex,
        data_start_row_index: dataStartRowIndex,
      };

      const response = await fetch(`/api/file-formats/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "テンプレートの更新に失敗しました");
      }

      const updatedTemplate = (await response.json()) as FileFormatTemplate;
      toast.success("テンプレートを更新しました");
      onUpdated(updatedTemplate);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "テンプレートの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const isExcel = template.file_type === "excel";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            テンプレート編集 ({template.file_type === "excel" ? "Excel" : "CSV"})
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isExcel && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ヘッダー行 (行番号)
                </label>
                <input
                  type="number"
                  min={1}
                  value={headerRowIndex + 1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setHeaderRowIndex(Number.isNaN(value) ? 0 : Math.max(value - 1, 0));
                  }}
                  className="h-10 border rounded px-3 w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Excelのヘッダー行（1始まり）。例: 1 行目 → 1
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  データ開始行 (行番号)
                </label>
                <input
                  type="number"
                  min={1}
                  value={dataStartRowIndex + 1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setDataStartRowIndex(Number.isNaN(value) ? 1 : Math.max(value - 1, 0));
                  }}
                  className="h-10 border rounded px-3 w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  明細データが開始する行（1始まり）。例: 2 行目 → 2
                </p>
              </div>
            </div>
          )}

          {!isExcel && (
            <div className="rounded border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
              CSVの場合、カラム名はヘッダーの文字列を入力してください。
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-4">カラムマッピング</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 w-48">システム項目</th>
                    <th className="text-left p-3">カラム指定 ({isExcel ? "列名 (例: A)" : "ヘッダー名"})</th>
                    <th className="text-left p-3 w-64">ヘッダー表示 (任意)</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_ORDER.map((field) => {
                    const info = SYSTEM_FIELDS[field];
                    const current = columnMapping[field];
                    return (
                      <tr key={field} className="border-t">
                        <td className="p-3 align-top">
                          {info.label}
                          {info.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="p-3">
                          <input
                            value={current?.column ?? ""}
                            onChange={(e) => handleMappingChange(field, e.target.value)}
                            className="h-9 w-full border rounded px-2"
                            placeholder={isExcel ? "例: A" : "例: 商品コード"}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            value={current?.header_name ?? ""}
                            onChange={(e) => handleHeaderNameChange(field, e.target.value)}
                            className="h-9 w-full border rounded px-2"
                            placeholder="任意"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-500 p-3 bg-slate-50 border-t">
                未入力の項目はマッピングから除外されます。
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded border hover:bg-slate-50"
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              className="h-10 px-6 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

