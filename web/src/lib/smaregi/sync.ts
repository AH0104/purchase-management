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

/**
 * 指定された商品コードのうち、未登録のもののみスマレジから部門情報を取得して登録
 * @param productCodes 同期対象の商品コード配列
 * @returns 新規登録された商品数
 */
export async function syncNewProductDepartments(productCodes: string[]): Promise<number> {
  if (productCodes.length === 0) return 0;

  // 空文字や null を除外して正規化
  const normalizedCodes = Array.from(
    new Set(
      productCodes
        .filter((code): code is string => typeof code === "string" && code.trim() !== "")
        .map((code) => code.trim())
    )
  );

  if (normalizedCodes.length === 0) return 0;

  // 既に登録済みの商品コードを取得
  const { data: existingProducts, error: existingError } = await supabase
    .from("smaregi_products")
    .select("product_code")
    .in("product_code", normalizedCodes);

  if (existingError) {
    throw new Error(`Failed to check existing products: ${existingError.message}`);
  }

  const existingCodes = new Set((existingProducts || []).map((p) => p.product_code));

  // 未登録の商品コードのみ抽出
  const newCodes = normalizedCodes.filter((code) => !existingCodes.has(code));

  if (newCodes.length === 0) {
    return 0; // 全て登録済み
  }

  // スマレジAPIから未登録商品の部門情報を取得
  const products = await fetchProductsByCodes(newCodes);
  await upsertProducts(products);

  return products.length;
}

export async function syncSmaregi(): Promise<SyncSummary> {
  const [departments] = await Promise.all([fetchAllDepartments()]);

  await upsertDepartments(departments);

  // 仕入データに存在する商品コードから部門情報を取得（差分のみ）
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

  // 差分同期を利用（未登録商品のみ取得）
  const newProductCount = await syncNewProductDepartments(distinctCodes);

  return {
    departmentCount: departments.length,
    productCount: newProductCount,
    syncedAt: new Date().toISOString(),
  };
}
