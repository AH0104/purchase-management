"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DriveImportQueueItem, DriveImportStatus } from "@/types/drive";
import type { Supplier } from "@/types/supplier";
import { fetchActiveSuppliers } from "@/lib/suppliers";

const STATUS_LABELS: Record<DriveImportStatus, string> = {
  pending: "要処理",
  pending_supplier: "仕入先未確定",
  ready: "準備完了",
  processing: "処理中",
  processed: "処理済み",
  error: "エラー",
};

const STATUS_ORDER: DriveImportStatus[] = [
  "pending_supplier",
  "pending",
  "ready",
  "processing",
  "error",
  "processed",
];

type QueueResponse = {
  data: DriveImportQueueItem[];
  counts: Record<DriveImportStatus, number>;
};

export default function DriveImportsPage() {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<DriveImportQueueItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<DriveImportStatus[]>(["pending_supplier", "pending", "error"]);
  const [counts, setCounts] = useState<Record<DriveImportStatus, number>>({
    pending: 0,
    pending_supplier: 0,
    ready: 0,
    processing: 0,
    processed: 0,
    error: 0,
  });
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    const loadSuppliers = async () => {
      try {
        const list = await fetchActiveSuppliers();
        if (active) {
          setSuppliers(list);
        }
      } catch (error) {
        console.error(error);
        toast.error("仕入先リストの取得に失敗しました");
      }
    };
    loadSuppliers();
    return () => {
      active = false;
    };
  }, []);

  const loadQueue = async (statuses = selectedStatuses) => {
    setLoading(true);
    try {
      const statusParam = statuses.length > 0 ? `?status=${statuses.join(",")}` : "";
      const res = await fetch(`/api/drive/import-queue${statusParam}`);
      if (!res.ok) {
        throw new Error("保留キューの取得に失敗しました");
      }
      const data = (await res.json()) as QueueResponse;
      setQueue(data.data);
      setCounts(data.counts);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "保留キューの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusFilter = (status: DriveImportStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(next);
    loadQueue(next);
  };

  const handleAssignSupplier = async (item: DriveImportQueueItem, supplierId: number | null) => {
    try {
      const body: Record<string, unknown> = {
        supplierId,
      };
      if (supplierId) {
        body.status = "pending";
      }
      const res = await fetch(`/api/drive/import-queue/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error("更新に失敗しました");
      }
      toast.success("更新しました");
      await loadQueue();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "更新に失敗しました");
    }
  };

  const handleProcess = async (item: DriveImportQueueItem) => {
    setProcessingIds((prev) => [...prev, item.id]);
    toast.loading("処理を開始します…", { id: `process-${item.id}` });
    try {
      const res = await fetch(`/api/drive/import-queue/${item.id}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "処理に失敗しました");
      }
      toast.success("処理が完了しました", { id: `process-${item.id}` });
      await loadQueue();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "処理に失敗しました", {
        id: `process-${item.id}`,
      });
    } finally {
      setProcessingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const isProcessing = (id: number) => processingIds.includes(id);

  const supplierOptions = useMemo(() => suppliers.map((s) => ({ id: s.id, name: s.supplier_name })), [suppliers]);

  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Google Drive 保留BOX</h1>
          <p className="text-sm text-slate-500 mt-1">監視フォルダから取り込まれたファイルの確認・仕入先設定・処理実行を行います。</p>
        </div>
        <button
          className="h-9 px-4 rounded bg-teal-600 text-white text-sm"
          onClick={() => loadQueue()}
          disabled={loading}
        >
          {loading ? "更新中…" : "再読み込み"}
        </button>
      </header>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-slate-600">ステータスフィルタ:</span>
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              className={`h-8 px-3 rounded-full text-sm border ${
                selectedStatuses.includes(status) ? "bg-teal-100 border-teal-500 text-teal-700" : "bg-white"
              }`}
              onClick={() => handleStatusFilter(status)}
            >
              {STATUS_LABELS[status]} ({counts[status] ?? 0})
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white">
        <table className="min-w-full">
          <thead className="bg-slate-100 text-left text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">ファイル名</th>
              <th className="px-4 py-3 w-48">仕入先</th>
              <th className="px-4 py-3 w-40">推定情報</th>
              <th className="px-4 py-3">フォルダ</th>
              <th className="px-4 py-3 w-32">ステータス</th>
              <th className="px-4 py-3 w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  保留中のファイルはありません
                </td>
              </tr>
            ) : (
              queue.map((item) => (
                <tr key={item.id} className="border-t text-sm">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <a
                        href={item.web_view_link ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-600 hover:underline font-medium"
                      >
                        {item.file_name}
                      </a>
                      <div className="text-xs text-slate-500">
                        作成: {item.created_at ? new Date(item.created_at).toLocaleString("ja-JP") : "-"}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="w-full h-9 border rounded px-2 text-sm"
                      value={item.supplier_id ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        handleAssignSupplier(item, value ? Number(value) : null);
                      }}
                      disabled={isProcessing(item.id)}
                    >
                      <option value="">未選択</option>
                      {supplierOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-col gap-1">
                      <span>推定コード: {item.inferred_supplier_code ?? "-"}</span>
                      <span>推定名: {item.inferred_supplier_name ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-col gap-1">
                      <span>{item.source_path ?? "(監視フォルダ直下)"}</span>
                      <span>ID: {item.source_folder_id ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-6 items-center rounded-full px-3 text-xs border ${
                      item.status === "pending_supplier"
                        ? "border-amber-300 text-amber-700 bg-amber-50"
                        : item.status === "error"
                          ? "border-rose-300 text-rose-700 bg-rose-50"
                          : item.status === "processed"
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : "border-slate-300 text-slate-600 bg-slate-50"
                    }`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.error_message ? (
                      <p className="mt-2 text-xs text-rose-600">エラー: {item.error_message}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        className="h-8 rounded bg-teal-600 text-white text-xs"
                        onClick={() => handleProcess(item)}
                        disabled={isProcessing(item.id) || !item.supplier_id}
                      >
                        {isProcessing(item.id) ? "処理中…" : "取り込み"}
                      </button>
                      {item.status === "error" ? (
                        <button
                          className="h-8 rounded border text-xs"
                          onClick={() => handleProcess(item)}
                          disabled={isProcessing(item.id) || !item.supplier_id}
                        >
                          再実行
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}








