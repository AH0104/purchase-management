import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// GET: ダッシュボード統計情報取得
export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];
    const endOfMonthStr = endOfMonth.toISOString().split("T")[0];

    // 今月の仕入総額
    const { data: monthlyTotal, error: monthlyError } = await supabase
      .from("delivery_notes")
      .select("total_amount")
      .gte("delivery_date", startOfMonthStr)
      .lte("delivery_date", endOfMonthStr);

    if (monthlyError) throw monthlyError;

    const totalAmount = (monthlyTotal || []).reduce((sum, note) => sum + (note.total_amount || 0), 0);

    // 未処理件数（status = 'pending'）
    const { count: pendingCount, error: pendingError } = await supabase
      .from("delivery_notes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (pendingError) throw pendingError;

    // 仕入先別集計（今月）
    const { data: supplierStats, error: supplierError } = await supabase
      .from("delivery_notes")
      .select(
        `
        total_amount,
        suppliers:supplier_id (
          id,
          supplier_name
        )
      `
      )
      .gte("delivery_date", startOfMonthStr)
      .lte("delivery_date", endOfMonthStr);

    if (supplierError) throw supplierError;

    // 仕入先別に集計
    const supplierMap = new Map<number, { name: string; amount: number }>();
    (supplierStats || []).forEach((stat: any) => {
      const supplier = stat.suppliers;
      if (supplier) {
        const existing = supplierMap.get(supplier.id) || { name: supplier.supplier_name, amount: 0 };
        existing.amount += stat.total_amount || 0;
        supplierMap.set(supplier.id, existing);
      }
    });

    const supplierBreakdown = Array.from(supplierMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // 上位10社

    // 直近のアップロード（最新10件）
    const { data: recentUploads, error: recentError } = await supabase
      .from("delivery_notes")
      .select(
        `
        id,
        delivery_date,
        total_amount,
        original_file_name,
        created_at,
        suppliers:supplier_id (
          supplier_name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    const recent = (recentUploads || []).map((upload: any) => ({
      id: upload.id,
      delivery_date: upload.delivery_date,
      total_amount: upload.total_amount,
      original_file_name: upload.original_file_name,
      created_at: upload.created_at,
      supplier_name: upload.suppliers?.supplier_name || null,
    }));

    // 部門情報と在庫情報
    const [{ data: departments, error: departmentError }, { data: productMappings, error: productError }] = await Promise.all([
      supabase.from("smaregi_departments").select("department_id, name, synced_at"),
      supabase.from("smaregi_products").select("product_code, department_id, synced_at"),
    ]);

    if (departmentError) throw departmentError;
    if (productError) throw productError;

    const departmentNameMap = new Map<string, string>();
    let latestDepartmentSync: string | null = null;
    (departments || []).forEach((dept) => {
      departmentNameMap.set(dept.department_id, dept.name);
      if (dept.synced_at && (!latestDepartmentSync || dept.synced_at > latestDepartmentSync)) {
        latestDepartmentSync = dept.synced_at;
      }
    });

    const productDepartmentMap = new Map<string, string | null>();
    let latestProductSync: string | null = null;
    (productMappings || []).forEach((product) => {
      productDepartmentMap.set(product.product_code, product.department_id ?? null);
      if (product.synced_at && (!latestProductSync || product.synced_at > latestProductSync)) {
        latestProductSync = product.synced_at;
      }
    });

    // 月次の明細から部門別仕入総額を算出
    const { data: monthlyItems, error: itemsError } = await supabase
      .from("delivery_note_items")
      .select("product_code, amount, delivery_date")
      .gte("delivery_date", startOfMonthStr)
      .lte("delivery_date", endOfMonthStr);

    if (itemsError) throw itemsError;

    const purchaseByDepartment = new Map<string, number>();
    const UNASSIGNED_DEPARTMENT = "__unassigned__";

    (monthlyItems || []).forEach((item) => {
      const departmentId = item.product_code ? productDepartmentMap.get(item.product_code) || UNASSIGNED_DEPARTMENT : UNASSIGNED_DEPARTMENT;
      const amount = item.amount ?? 0;
      purchaseByDepartment.set(departmentId, (purchaseByDepartment.get(departmentId) || 0) + amount);
    });

    const departmentPurchaseBreakdown = Array.from(purchaseByDepartment.entries())
      .map(([departmentId, amount]) => ({
        departmentId,
        name: departmentId === UNASSIGNED_DEPARTMENT ? "未分類" : departmentNameMap.get(departmentId) || "未分類",
        amount,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const smaregiLastSyncedAt = [latestDepartmentSync, latestProductSync]
      .filter((value): value is string => typeof value === "string")
      .sort((a, b) => (a < b ? 1 : -1))[0] ?? null;

    return NextResponse.json({
      monthlyTotal: totalAmount,
      pendingCount: pendingCount || 0,
      supplierBreakdown,
      recentUploads: recent,
      departmentPurchaseBreakdown,
      smaregiLastSyncedAt,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "統計情報の取得でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

