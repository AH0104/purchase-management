"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DeliveryInvoiceSummary, DeliveryNoteWithItems } from "@/types/delivery";
import { Supplier } from "@/types/supplier";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function DataPage() {
  const [invoices, setInvoices] = useState<DeliveryInvoiceSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<DeliveryNoteWithItems | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<DeliveryInvoiceSummary | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [keyword, startDate, endDate, supplierId, status]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("仕入先の取得に失敗しました");
      const data = await res.json();
      setSuppliers(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("仕入先の取得に失敗しました");
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (supplierId) params.set("supplierId", supplierId);
      if (status) params.set("status", status);

      const res = await fetch(`/api/delivery-notes/invoices?${params.toString()}`);
      if (!res.ok) throw new Error("伝票データの取得に失敗しました");
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("伝票データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceClick = async (invoice: DeliveryInvoiceSummary) => {
    try {
      const res = await fetch(`/api/delivery-notes/${invoice.deliveryNoteId}`);
      if (!res.ok) throw new Error("詳細の取得に失敗しました");
      const detail = (await res.json()) as DeliveryNoteWithItems;

      const filteredItems = (detail.items || []).filter((item) =>
        invoice.deliveryNoteNumber ? item.delivery_note_number === invoice.deliveryNoteNumber : !item.delivery_note_number
      );

      setSelectedInvoice(invoice);
      setSelectedNote({
        ...detail,
        delivery_date: invoice.deliveryDate ?? detail.delivery_date,
        delivery_note_number: invoice.deliveryNoteNumber ?? detail.delivery_note_number,
        total_amount: invoice.totalAmount,
        supplier_name: invoice.supplierName ?? detail.supplier_name,
        items: filteredItems,
      });
      setShowDetail(true);
    } catch (error) {
      console.error(error);
      toast.error("詳細の取得に失敗しました");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("ja-JP");
  };

  const handleExportCSV = () => {
    if (invoices.length === 0) {
      toast.error("出力するデータがありません");
      return;
    }

    const csvData = invoices.map((invoice) => ({
      日付: invoice.deliveryDate || "",
      伝票番号: invoice.deliveryNoteNumber || "-",
      仕入先: invoice.supplierName || "-",
      明細数: invoice.itemCount,
      合計: invoice.totalAmount,
      状態:
        invoice.status === "pending"
          ? "未処理"
          : invoice.status === "reconciled"
          ? "消込済"
          : "支払済",
      ファイル名: invoice.originalFileName,
      最終更新: formatDate(invoice.updatedAt),
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `納品データ_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("CSVファイルをダウンロードしました");
  };

  const handleExportExcel = async () => {
    if (invoices.length === 0) {
      toast.error("出力するデータがありません");
      return;
    }

    try {
      const wsData = invoices.map((invoice) => ({
        日付: invoice.deliveryDate || "",
        伝票番号: invoice.deliveryNoteNumber || "-",
        仕入先: invoice.supplierName || "-",
        明細数: invoice.itemCount,
        合計: invoice.totalAmount,
        状態:
          invoice.status === "pending"
            ? "未処理"
            : invoice.status === "reconciled"
            ? "消込済"
            : "支払済",
        ファイル名: invoice.originalFileName,
        最終更新: formatDate(invoice.updatedAt),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "納品データ");

      XLSX.writeFile(wb, `納品データ_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excelファイルをダウンロードしました");
    } catch (error) {
      console.error(error);
      toast.error("Excelファイルの出力に失敗しました");
    }
  };

  const resetFilters = () => {
    setKeyword("");
    setStartDate("");
    setEndDate("");
    setSupplierId("");
    setStatus("");
  };

  const suppliersOptions = useMemo(() => suppliers ?? [], [suppliers]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">納品データ一覧</h1>
        <Link
          href="/data/items"
          className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
        >
          商品コード検索へ移動
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-slate-600 mb-1">キーワード</label>
          <input
            placeholder="ファイル名・伝票番号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-10 w-full border rounded px-3"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 border rounded px-3"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 border rounded px-3"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">仕入先</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-10 border rounded px-2 min-w-[150px]"
          >
            <option value="">全仕入先</option>
            {suppliersOptions.map((s) => (
              <option key={s.id} value={s.id.toString()}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">ステータス</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 border rounded px-2"
          >
            <option value="">全ステータス</option>
            <option value="pending">未処理</option>
            <option value="reconciled">消込済</option>
            <option value="paid">支払済</option>
          </select>
        </div>
        <button
          onClick={resetFilters}
          className="h-10 px-4 rounded border hover:bg-slate-50"
        >
          リセット
        </button>
        <button
          onClick={handleExportCSV}
          className="h-10 px-4 rounded border hover:bg-slate-50"
        >
          CSV 出力
        </button>
        <button
          onClick={handleExportExcel}
          className="h-10 px-4 rounded border hover:bg-slate-50"
        >
          Excel 出力
        </button>
      </div>

      <div className="rounded-lg border bg-white p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">読み込み中...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">データがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left p-3">日付</th>
                <th className="text-left p-3">伝票番号</th>
                <th className="text-left p-3">仕入先</th>
                <th className="text-right p-3">明細数</th>
                <th className="text-right p-3">合計</th>
                <th className="text-left p-3">状態</th>
                <th className="text-left p-3">最終更新</th>
                <th className="text-left p-3">ファイル名</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={`${invoice.deliveryNoteId}-${invoice.deliveryNoteNumber ?? "null"}`}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleInvoiceClick(invoice)}
                >
                  <td className="p-3">{formatDate(invoice.deliveryDate)}</td>
                  <td className="p-3">{invoice.deliveryNoteNumber || "-"}</td>
                  <td className="p-3">{invoice.supplierName || "-"}</td>
                  <td className="p-3 text-right">{invoice.itemCount}</td>
                  <td className="p-3 text-right">{formatCurrency(invoice.totalAmount)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        invoice.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : invoice.status === "reconciled"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {invoice.status === "pending"
                        ? "未処理"
                        : invoice.status === "reconciled"
                        ? "消込済"
                        : "支払済"}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(invoice.updatedAt)}</td>
                  <td className="p-3">{invoice.originalFileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDetail && selectedNote && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-2xl overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">伝票詳細</h2>
              <button
                onClick={() => {
                  setShowDetail(false);
                  setSelectedNote(null);
                  setSelectedInvoice(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">納品日</label>
                  <div className="mt-1 font-medium">{formatDate(selectedInvoice.deliveryDate)}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">仕入先</label>
                  <div className="mt-1 font-medium">{selectedInvoice.supplierName || "-"}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">伝票番号</label>
                  <div className="mt-1 font-medium">{selectedInvoice.deliveryNoteNumber || "-"}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">合計金額</label>
                  <div className="mt-1 font-medium text-lg">{formatCurrency(selectedInvoice.totalAmount)}</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">状態</label>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        selectedInvoice.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : selectedInvoice.status === "reconciled"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {selectedInvoice.status === "pending"
                        ? "未処理"
                        : selectedInvoice.status === "reconciled"
                        ? "消込済"
                        : "支払済"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">ファイル名</label>
                  <div className="mt-1 font-medium">{selectedInvoice.originalFileName}</div>
                </div>
              </div>

              {selectedNote.items && selectedNote.items.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-3">明細</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2">行</th>
                          <th className="text-left p-2">納品書番号</th>
                          <th className="text-left p-2">商品コード</th>
                          <th className="text-left p-2">商品名</th>
                          <th className="text-right p-2">数量</th>
                          <th className="text-right p-2">単価</th>
                          <th className="text-right p-2">金額</th>
                          <th className="text-left p-2">納品日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedNote.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2">{item.line_number}</td>
                            <td className="p-2">{item.delivery_note_number || "-"}</td>
                            <td className="p-2">{item.product_code}</td>
                            <td className="p-2">{item.product_name}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                            <td className="p-2">{formatDate(item.delivery_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">該当する明細がありません。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
