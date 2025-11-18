import { getSmaregiConfig } from "./config";
import { SmaregiDepartment, SmaregiProduct, SmaregiStockRecord } from "@/types/smaregi";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TokenCache = {
  token: string;
  expiresAt: number; // epoch ms
};

const TOKEN_SAFETY_WINDOW = 60 * 1000; // 1 minute
let tokenCache: TokenCache | null = null;

function tokenEndpoint(authBase: string, contractId: string) {
  const normalizedBase = authBase.replace(/\/$/, "");
  const normalizedContract = contractId.replace(/^\//, "");
  return `${normalizedBase}/app/${normalizedContract}/token`;
}

async function requestAccessToken(): Promise<string> {
  const config = getSmaregiConfig();
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_WINDOW > now) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: config.scope,
  });

  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetch(tokenEndpoint(config.authBaseUrl, config.contractId), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Smaregi token request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in * 1000 : 3600 * 1000;
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return payload.access_token;
}

const PRODUCT_FIELDS = ["productId", "productCode", "categoryId"].join(",");

// 部門情報を取得（categoryIdから個別に取得）
export async function fetchAllDepartments(): Promise<SmaregiDepartment[]> {
  // 空配列を返す（商品取得時に自動的に部門情報も取得される）
  return [];
}

// 部門情報を個別に取得
async function fetchCategoryById(categoryId: string): Promise<SmaregiDepartment | null> {
  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const contractId = config.contractId;

  try {
    const response = await fetch(`${baseUrl}/${contractId}/pos/categories/${categoryId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`[Smaregi] Category ${categoryId} request failed: ${response.status}`);
      return null;
    }

    const category = (await response.json()) as any;

    return {
      departmentId: category.categoryId,
      name: category.categoryName || category.categoryAbbr || `部門${categoryId}`,
      parentDepartmentId: category.parentCategoryId || null,
      level: category.level ? parseInt(category.level, 10) : null,
    };
  } catch (error) {
    console.warn(`[Smaregi] Error fetching category ${categoryId}:`, error);
    return null;
  }
}

// 部門情報を取得してデータベースに保存
async function fetchAndStoreDepartments(categoryIds: string[]): Promise<void> {
  const departments: SmaregiDepartment[] = [];

  for (const categoryId of categoryIds) {
    const department = await fetchCategoryById(categoryId);
    if (department) {
      departments.push(department);
    }
  }

  if (departments.length === 0) {
    console.log('[Smaregi] No departments to store');
    return;
  }

  // データベースに保存（upsert）
  const { error } = await supabase
    .from("smaregi_departments")
    .upsert(
      departments.map((dept) => ({
        department_id: dept.departmentId,
        name: dept.name,
        parent_department_id: dept.parentDepartmentId,
        level: dept.level,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "department_id" }
    );

  if (error) {
    console.error("[Smaregi] Failed to store departments:", error);
  } else {
    console.log(`[Smaregi] Successfully stored ${departments.length} departments`);
  }
}

export async function fetchProductsByCodes(codes: string[]): Promise<SmaregiProduct[]> {
  if (codes.length === 0) return [];

  const normalizedTargets = new Map<string, string>();
  codes.forEach((code) => {
    if (!code) return;
    const normalized = code.trim();
    if (!normalized) return;
    normalizedTargets.set(normalized, code);
  });

  if (normalizedTargets.size === 0) return [];

  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const contractId = config.contractId;

  const results: SmaregiProduct[] = [];
  const foundCodes = new Set<string>();
  const categoryIds = new Set<string>();

  // 各商品コードを個別に検索（offsetはサポートされていない）
  for (const productCode of Array.from(normalizedTargets.keys())) {
    try {
      const params = new URLSearchParams({
        product_code: productCode,
      });

      const response = await fetch(`${baseUrl}/${contractId}/pos/products?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`[Smaregi] Product ${productCode} request failed: ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as any[];

      // デバッグ: 最初の商品のフィールドをログ出力
      if (payload.length > 0 && results.length === 0) {
        console.log('[Smaregi Debug] First product fields:', Object.keys(payload[0]));
        console.log('[Smaregi Debug] First product sample:', JSON.stringify(payload[0], null, 2));
      }

      if (payload.length > 0) {
        const product = payload[0];
        const originalCode = normalizedTargets.get(productCode) ?? productCode;
        const categoryId = product.categoryId ?? null;

        if (!foundCodes.has(productCode)) {
          results.push({
            productCode: originalCode,
            productId: product.productId ?? null,
            productName: product.productName ?? null,
            departmentId: categoryId,
          });
          foundCodes.add(productCode);

          // カテゴリーIDを収集（後で部門情報を取得）
          if (categoryId) {
            categoryIds.add(categoryId);
          }
        }
      }
    } catch (error) {
      console.warn(`[Smaregi] Error fetching product ${productCode}:`, error);
    }
  }

  // 収集したカテゴリーIDから部門情報を取得
  if (categoryIds.size > 0) {
    console.log(`[Smaregi] Fetching ${categoryIds.size} unique category/department names...`);

    // 部門情報を取得して Map に格納
    const departmentMap = new Map<string, string>();
    for (const categoryId of Array.from(categoryIds)) {
      const department = await fetchCategoryById(categoryId);
      if (department) {
        departmentMap.set(categoryId, department.name);
      }
    }

    // 商品データに部門名を追加
    results.forEach((product) => {
      if (product.departmentId) {
        product.departmentName = departmentMap.get(product.departmentId) || null;
      }
    });

    // smaregi_departments テーブルにも保存
    await fetchAndStoreDepartments(Array.from(categoryIds));
  }

  return results;
}

export function clearSmaregiTokenCache() {
  tokenCache = null;
}
