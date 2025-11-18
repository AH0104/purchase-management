"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import Link from "next/link";

type Breakdown = { departmentId: string; name: string; amount: number };

type DashboardStats = {
  monthlyTotal: number;
  pendingCount: number;
  supplierBreakdown: { name: string; amount: number }[];
  recentUploads: {
    id: number;
    delivery_date: string;
    total_amount: number;
    original_file_name: string;
    created_at: string;
    supplier_name: string | null;
  }[];
  departmentPurchaseBreakdown: Breakdown[];
  smaregiLastSyncedAt?: string | null;
};

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

const COLORS = ["#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#84cc16"];

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // デフォルトは今月
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          year: selectedYear.toString(),
          month: selectedMonth.toString(),
        });
        const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
        if (!res.ok) throw new Error("統計情報の取得に失敗しました");
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedYear, selectedMonth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="text-center py-12 text-slate-500">読み込み中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="text-center py-12 text-red-500">データの取得に失敗しました</div>
      </div>
    );
  }

  // 年の選択肢（過去5年分）
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="flex gap-2 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-10 border rounded px-3 bg-white"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-10 border rounded px-3 bg-white"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {month}月
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="今月の仕入総額" value={formatCurrency(stats.monthlyTotal)} />
        <SummaryCard title="未処理件数" value={`${stats.pendingCount}件`} />
        <SummaryCard title="今月支払予定" value={formatCurrency(stats.monthlyTotal)} />
        <SummaryCard
          title="スマレジ同期"
          value={
            stats.smaregiLastSyncedAt
              ? new Date(stats.smaregiLastSyncedAt).toLocaleString("ja-JP")
              : "未同期"
          }
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard
          title="未消込件数"
          value={`${stats.pendingCount}件`}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold mb-4">仕入先別集計（今月）</h2>
          {stats.supplierBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.supplierBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  fontSize={12}
                />
                <YAxis tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "#000" }}
                />
                <Bar dataKey="amount" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400">
              データがありません
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold mb-4">仕入先別構成比（今月）</h2>
          {stats.supplierBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.supplierBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: PieLabelRenderProps) => {
                    const labelName = typeof name === "string" ? name : "未分類";
                    const ratio = typeof percent === "number" ? percent : 0;
                    return `${labelName}: ${(ratio * 100).toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {stats.supplierBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400">
              データがありません
            </div>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold mb-4">部門別仕入金額（今月）</h2>
        {stats.departmentPurchaseBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.departmentPurchaseBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-30}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={12}
              />
              <YAxis tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">データがありません</div>
        )}
      </div>
      <Link
        href="/upload"
        className="fixed right-6 bottom-6 h-12 px-6 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
      >
        <span>⬆️</span>
        <span>ファイルをアップロード</span>
      </Link>
    </div>
  );
}
