import { supabase } from "@/lib/supabaseClient";
import { fetchAllDepartments, fetchProductsByCodes } from "./client";
import { SmaregiDepartment, SmaregiProduct } from "@/types/smaregi";

export type SyncSummary = {
  departmentCount: number;
  productCount: number;
  syncedAt: string;
};

async function upsertDepartments(departments: SmaregiDepartment[]) {
  if (departments.length === 0) return;
  const rows = departments.map((department) => ({
    department_id: department.departmentId,
    name: department.name,
    parent_department_id: department.parentDepartmentId ?? null,
    level: department.level ?? null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("smaregi_departments").upsert(rows, {
    onConflict: "department_id",
  });

  if (error) {
    throw new Error(`Failed to upsert smaregi_departments: ${error.message}`);
  }
}

async function upsertProducts(products: SmaregiProduct[]) {
  if (products.length === 0) return;

  const rows = products.map((product) => ({
    product_code: product.productCode,
    product_id: product.productId ?? null,
    department_id: product.departmentId ?? null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("smaregi_products").upsert(rows, {
    onConflict: "product_code",
  });

  if (error) {
    throw new Error(`Failed to upsert smaregi_products: ${error.message}`);
  }
}

export async function syncSmaregi(): Promise<SyncSummary> {
  const [departments] = await Promise.all([fetchAllDepartments()]);

  await upsertDepartments(departments);

  // 仕入データに存在する商品コードから部門情報を取得
  const { data: productCodeRows, error: productCodeError } = await supabase
    .from("delivery_note_items")
    .select("product_code")
    .not("product_code", "is", null)
    .neq("product_code", "");

  if (productCodeError) {
    throw new Error(`Failed to load product codes: ${productCodeError.message}`);
  }

  const distinctCodes = Array.from(
    new Set((productCodeRows || []).map((row) => row.product_code).filter((code): code is string => typeof code === "string" && code.trim() !== ""))
  );

  const products = distinctCodes.length > 0 ? await fetchProductsByCodes(distinctCodes) : [];
  await upsertProducts(products);

  return {
    departmentCount: departments.length,
    productCount: products.length,
    syncedAt: new Date().toISOString(),
  };
}
