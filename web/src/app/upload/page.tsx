"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { uploadFileWithProgress } from "@/lib/upload/client";
import { useUploadStore } from "@/store/uploadStore";
import { fetchActiveSuppliers } from "@/lib/suppliers";
import { Supplier } from "@/types/supplier";
import { DeliveryNoteInput, DeliveryNoteItemInput } from "@/types/delivery";
import { ColumnMappingDialog } from "@/components/ColumnMappingDialog";
import { FileFormatTemplate, FileFormatTemplateInput } from "@/types/file-format";
import { parseExcelFile } from "@/lib/parsers/excel";
import { parseCsvFile } from "@/lib/parsers/csv";

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 10);

export default function UploadPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [noteData, setNoteData] = useState<DeliveryNoteInput | null>(null);

  const {
    step,
    supplierId,
    supplierName,
    setSupplier,
    file,
    setFile,
    result,
    setResult,
    setStep,
    uploadProgress,
    setProgress,
    reset,
    needsMapping,
    setNeedsMapping,
  } = useUploadStore();
  
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [template, setTemplate] = useState<FileFormatTemplate | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingSuppliers(true);
      try {
        const data = await fetchActiveSuppliers();
        if (active) setSuppliers(data);
      } catch (error) {
        toast.error("仕入先の取得に失敗しました");
      } finally {
        setLoadingSuppliers(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (result) {
      // ヘッダーの納品日を各明細行にコピー（明細行に納品日がない場合）
      const itemsWithDeliveryDate = result.deliveryNote.items.map((item) => ({
        ...item,
        deliveryDate: item.deliveryDate || result.deliveryNote.deliveryDate || "",
      }));
      setNoteData({
        ...result.deliveryNote,
        items: itemsWithDeliveryDate,
      });
    }
  }, [result]);

  const selectedSupplierName = useMemo(() => {
    if (!supplierId) return undefined;
    return suppliers.find((s) => s.id === supplierId)?.supplier_name ?? supplierName;
  }, [supplierId, supplierName, suppliers]);

  const handleSupplierChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = Number(event.target.value);
    if (!id) {
      setSupplier(null);
      return;
    }
    const supplier = suppliers.find((s) => s.id === id);
    setSupplier(id, supplier?.supplier_name);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const sizeMb = selected.size / (1024 * 1024);
    if (sizeMb > MAX_UPLOAD_MB) {
      toast.error(`ファイルサイズが大きすぎます（最大 ${MAX_UPLOAD_MB}MB）`);
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("ファイルを選択してください");
      return;
    }
    if (!supplierId) {
      toast.error("仕入先を選択してください");
      return;
    }

    setProgress(0);
    toast.loading("解析中です…", { id: "upload" });

    try {
      // ファイル形式を判定
      const fileName = file.name.toLowerCase();
      const fileType = fileName.endsWith(".csv") ? "csv" : fileName.endsWith(".xlsx") || fileName.endsWith(".xls") ? "excel" : null;

      // テンプレートを取得（Excel/CSVの場合のみ）
      let template: FileFormatTemplate | null = null;
      if (fileType) {
        try {
          const templateRes = await fetch(`/api/file-formats/templates?supplierId=${supplierId}&fileType=${fileType}`);
          if (templateRes.ok) {
            const templateData = await templateRes.json();
            if (templateData.data && templateData.data.length > 0) {
              template = templateData.data[0];
            }
          }
        } catch (error) {
          console.error("テンプレート取得エラー:", error);
        }
      }

      setTemplate(template);

      // PDFの場合は従来通りAPI経由
      if (fileName.endsWith(".pdf")) {
        const result = await uploadFileWithProgress({
          file,
          supplierId,
          onProgress: (percent) => {
            setProgress(percent);
          },
        });
        setResult(result);
        setStep(2);
        toast.success("解析が完了しました", { id: "upload" });
        return;
      }

      // Excel/CSVの場合はクライアント側で解析
      let result;
      if (fileType === "excel") {
        result = await parseExcelFile({ file, supplierId, template: template || undefined });
      } else if (fileType === "csv") {
        result = await parseCsvFile({ file, supplierId, template: template || undefined });
      } else {
        throw new Error("対応していないファイル形式です");
      }

      // テンプレートがない場合はマッピング設定を表示
      // 明細が抽出できなかった場合、または警告がある場合も表示
      if (!template) {
        // Excel/CSVの場合、テンプレートがない場合は必ずマッピング設定を表示
        // 明細が抽出できなかった場合、または警告がある場合は必須で表示
        // 明細が抽出できた場合でも、ユーザーがマッピングを確認・調整できるように表示
        if (result.deliveryNote.items.length === 0 || result.warnings.length > 0) {
          setNeedsMapping(true);
          setShowMappingDialog(true);
          setResult(result);
          setStep(1.5);
          toast.dismiss("upload");
          return;
        }
        // 明細は抽出できたが、テンプレートがない場合はマッピング設定を表示
        // ユーザーが手動でマッピングを確認・調整できるようにする
        setNeedsMapping(true);
        setShowMappingDialog(true);
        setResult(result);
        setStep(1.5);
        toast.dismiss("upload");
        return;
      }

      setResult(result);
      setStep(2);
      toast.success("解析が完了しました", { id: "upload" });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "解析に失敗しました", {
        id: "upload",
      });
    }
  };

  const handleMappingApply = async (mappingInput: FileFormatTemplateInput, saveAsTemplate: boolean) => {
    try {
      // テンプレートとして保存
      if (saveAsTemplate) {
        const res = await fetch("/api/file-formats/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mappingInput),
        });
        if (!res.ok) {
          throw new Error("テンプレートの保存に失敗しました");
        }
        const savedTemplate = await res.json();
        setTemplate(savedTemplate);
        toast.success("テンプレートを保存しました");
      }

      // マッピングを使って再解析
      if (!file || !supplierId) return;

      const fileName = file.name.toLowerCase();
      const fileType = fileName.endsWith(".csv") ? "csv" : "excel";
      
      const templateForParse: FileFormatTemplate = {
        id: 0,
        supplier_id: mappingInput.supplier_id,
        file_type: mappingInput.file_type,
        column_mapping: mappingInput.column_mapping,
        header_row_index: mappingInput.header_row_index,
        data_start_row_index: mappingInput.data_start_row_index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let result;
      if (fileType === "excel") {
        result = await parseExcelFile({ file, supplierId, template: templateForParse });
      } else {
        result = await parseCsvFile({ file, supplierId, template: templateForParse });
      }

      setResult(result);
      setShowMappingDialog(false);
      setNeedsMapping(false);
      setStep(2);
      toast.success("マッピングを適用しました");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "マッピングの適用に失敗しました");
    }
  };

  const handleReset = () => {
    reset();
    setNoteData(null);
  };

  const updateItem = (lineNumber: number, field: keyof DeliveryNoteItemInput, value: string) => {
    if (!noteData) return;
    const items = noteData.items.map((item) => {
      if (item.lineNumber !== lineNumber) return item;
      if (field === "productName" || field === "productCode" || field === "deliveryNoteNumber" || field === "deliveryDate" || field === "remarks") {
        return { ...item, [field]: value };
      }
      const numericValue = Number(value);
      return { ...item, [field]: Number.isNaN(numericValue) ? 0 : numericValue };
    });
    setNoteData({ ...noteData, items });
  };

  const updateHeader = (field: keyof DeliveryNoteInput, value: string) => {
    if (!noteData) return;
    if (field === "totalAmount") {
      const numericValue = Number(value);
      setNoteData({ ...noteData, [field]: Number.isNaN(numericValue) ? 0 : numericValue });
      return;
    }
    setNoteData({ ...noteData, [field]: value });
  };

  const handleSave = async () => {
    if (!noteData) return;
    toast.loading("保存しています…", { id: "save" });
    try {
      const response = await fetch("/api/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNote: noteData }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "保存に失敗しました");
      }
      toast.success("保存が完了しました", { id: "save" });
      setStep(3);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "保存に失敗しました", {
        id: "save",
      });
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ファイルアップロード</h1>
        <button className="text-sm text-teal-600" onClick={handleReset}>
          リセット
        </button>
      </div>

      <StepIndicator step={step} />

      {step === 1.5 && result && file && (
        <ColumnMappingDialog
          isOpen={showMappingDialog}
          onClose={() => {
            setShowMappingDialog(false);
            setStep(1);
          }}
          onApply={handleMappingApply}
          fileType={file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel"}
          supplierId={supplierId!}
          rawData={result.rawPayload || []}
        />
      )}

      {step === 1 && (
        <section className="rounded-lg border bg-white p-6 grid gap-4 max-w-2xl">
          <div className="grid gap-2">
            <label className="text-sm font-medium">仕入先</label>
            <select
              className="h-10 border rounded px-3"
              onChange={handleSupplierChange}
              value={supplierId ?? ""}
              disabled={loadingSuppliers}
            >
              <option value="">選択してください</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">ファイル</label>
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileChange} />
            {uploadProgress > 0 && (
              <div className="h-2 rounded bg-slate-200">
                <div
                  className="h-full rounded bg-teal-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            {file && (
              <p className="text-sm text-slate-500">
                選択中: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button className="h-10 px-4 rounded bg-teal-600 text-white" onClick={handleUpload}>
              解析を開始
            </button>
          </div>
        </section>
      )}

      {step === 2 && noteData && (
        <section className="grid gap-6">
          <div className="rounded-lg border bg-white p-6 grid gap-4">
            <h2 className="font-semibold">ヘッダー情報</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs text-slate-500">仕入先</label>
                <input value={selectedSupplierName ?? ""} className="h-10 border rounded px-3 bg-slate-100" disabled />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-500">合計金額（税抜き）</label>
                <input
                  type="number"
                  value={noteData.totalAmount}
                  onChange={(e) => updateHeader("totalAmount", e.target.value)}
                  className="h-10 border rounded px-3"
                />
              </div>
            </div>
            {result?.warnings?.length ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <p className="font-medium">警告</p>
                <ul className="list-disc ml-5">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-white p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-left w-12">行</th>
                  <th className="p-3 text-left w-32">納品日</th>
                  <th className="p-3 text-left w-32">納品書番号</th>
                  <th className="p-3 text-left w-40">商品コード</th>
                  <th className="p-3 text-left min-w-[400px]">商品名</th>
                  <th className="p-3 text-right w-20">数量</th>
                  <th className="p-3 text-right w-24">単価</th>
                  <th className="p-3 text-right w-28">金額</th>
                  <th className="p-3 text-left">備考</th>
                </tr>
              </thead>
              <tbody>
                {noteData.items.map((item) => (
                  <tr key={item.lineNumber} className="border-t">
                    <td className="p-2 text-slate-500 text-center">{item.lineNumber}</td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={item.deliveryDate ?? ""}
                        onChange={(e) => updateItem(item.lineNumber, "deliveryDate", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-sm"
                        placeholder="納品日"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.deliveryNoteNumber ?? ""}
                        onChange={(e) => updateItem(item.lineNumber, "deliveryNoteNumber", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-sm"
                        placeholder="納品書番号"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.productCode}
                        onChange={(e) => updateItem(item.lineNumber, "productCode", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-sm"
                      />
                    </td>
                    <td className="p-2 min-w-[400px]">
                      <input
                        value={item.productName}
                        onChange={(e) => updateItem(item.lineNumber, "productName", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.lineNumber, "quantity", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-right text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.lineNumber, "unitPrice", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-right text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateItem(item.lineNumber, "amount", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-right text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.remarks ?? ""}
                        onChange={(e) => updateItem(item.lineNumber, "remarks", e.target.value)}
                        className="h-9 w-full border rounded px-2 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button className="h-10 px-4 rounded border" onClick={() => setStep(1)}>
              戻る
            </button>
            <button className="h-10 px-6 rounded bg-teal-600 text-white" onClick={handleSave}>
              保存する
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-lg border bg-white p-10 text-center grid gap-4">
          <h2 className="text-xl font-semibold">登録が完了しました</h2>
          <p className="text-slate-600">続けて別のファイルをアップロードする場合はリセットしてください。</p>
          <div className="flex justify-center gap-3">
            <button className="h-10 px-4 rounded border" onClick={() => setStep(2)}>
              プレビューに戻る
            </button>
            <button className="h-10 px-6 rounded bg-teal-600 text-white" onClick={handleReset}>
              新しくアップロード
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { id: 1, label: "ファイル選択" },
    { id: 1.5, label: "マッピング設定" },
    { id: 2, label: "データ確認" },
    { id: 3, label: "保存完了" },
  ];
  return (
    <ol className="flex items-center gap-6 text-sm">
      {steps.map((item, index) => {
        const isActive = step === item.id;
        const isCompleted = typeof step === "number" && typeof item.id === "number" && step > item.id;
        const isVisible = item.id !== 1.5 || step === 1.5;
        
        if (!isVisible && item.id === 1.5) return null;
        
        return (
          <li key={item.id} className="flex items-center gap-2">
            <span
              className={`h-7 w-7 rounded-full grid place-items-center text-white text-xs ${
                isCompleted ? "bg-teal-600" : isActive ? "bg-teal-500" : "bg-slate-300"
              }`}
            >
              {item.id === 1.5 ? "1.5" : item.id}
            </span>
            <span className={isActive || isCompleted ? "text-slate-900" : "text-slate-400"}>{item.label}</span>
            {index < steps.length - 1 && <span className="text-slate-300">―</span>}
          </li>
        );
      })}
    </ol>
  );
}



