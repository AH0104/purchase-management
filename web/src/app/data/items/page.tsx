"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DeliveryItemRecord } from "@/types/delivery";
import { Supplier } from "@/types/supplier";
import { toast } from "sonner";

export default function ItemSearchPage() {
  const [productCode, setProductCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState<DeliveryItemRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

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

  const handleSearch = async () => {
    if (!productCode.trim()) {
      toast.error("商品コードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("productCode", productCode.trim());
      if (supplierId) params.set("supplierId", supplierId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/delivery-notes/items?${params.toString()}`);
      if (!res.ok) throw new Error("商品コード検索に失敗しました");
      const data = await res.json();
      setItems(data.data || []);
      if ((data.data || []).length === 0) {
        toast("該当するデータがありませんでした");
      }
    } catch (error) {
      console.error(error);
      toast.error("商品コード検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSupplierId("");
    setStartDate("");
    setEndDate("");
    setItems([]);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("ja-JP");
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">商品コード入荷履歴</h1>
        <Link href="/data" className="text-sm text-teal-600 hover:text-teal-700">
          納品データ一覧へ戻る
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-600 mb-1">
            商品コード <span className="text-red-500">*</span>
          </label>
          <input
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="例: ABC123"
            className="h-10 w-full border rounded px-3"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">仕入先</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-10 border rounded px-2 w-full"
          >
            <option value="">全仕入先</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id.toString()}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 border rounded px-3 w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 border rounded px-3 w-full"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSearch}
          className="h-10 px-4 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "検索中..." : "検索"}
        </button>
        <button
          onClick={resetFilters}
          className="h-10 px-4 rounded border hover:bg-slate-50"
          disabled={loading}
        >
          リセット
        </button>
      </div>

      <div className="rounded-lg border bg-white p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">検索中です...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">データがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left p-3">納品日</th>
                <th className="text-left p-3">伝票番号</th>
                <th className="text-left p-3">仕入先</th>
                <th className="text-left p-3">商品コード</th>
                <th className="text-left p-3">商品名</th>
                <th className="text-left p-3">部門</th>
                <th className="text-right p-3">数量</th>
                <th className="text-right p-3">単価</th>
                <th className="text-right p-3">金額</th>
                <th className="text-left p-3">備考</th>
                <th className="text-left p-3">ファイル名</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{formatDate(item.deliveryDate)}</td>
                  <td className="p-3">{item.deliveryNoteNumber || "-"}</td>
                  <td className="p-3">{item.supplierName || "-"}</td>
                  <td className="p-3">{item.productCode}</td>
                  <td className="p-3">{item.productName}</td>
                  <td className="p-3">
                    {(item as any).departmentName ? (
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
                        {(item as any).departmentName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">未分類</span>
                    )}
                  </td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-3 text-right">{formatCurrency(item.amount)}</td>
                  <td className="p-3">{item.remarks || "-"}</td>
                  <td className="p-3">{item.originalFileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
