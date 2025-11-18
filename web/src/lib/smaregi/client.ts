import { getSmaregiConfig } from "./config";
import { SmaregiDepartment, SmaregiProduct, SmaregiStockRecord } from "@/types/smaregi";

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

const PRODUCT_FIELDS = ["productId", "productCode", "departmentId"].join(",");

// 部門情報を取得（複数のエンドポイントを試す）
export async function fetchAllDepartments(): Promise<SmaregiDepartment[]> {
  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const contractId = config.contractId;

  // 試すエンドポイントのリスト
  const endpoints = [
    '/pos/divisions',      // 部門
    '/pos/departments',    // 部門（英語）
    '/pos/categories',     // カテゴリ
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`[Smaregi Debug] Trying endpoint: ${endpoint}`);

      const params = new URLSearchParams({
        limit: '10', // デバッグ用に少量取得
        offset: '0',
      });

      const response = await fetch(`${baseUrl}/${contractId}${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const payload = (await response.json()) as any;
        console.log(`[Smaregi Debug] ${endpoint} response:`, JSON.stringify(payload, null, 2));

        // レスポンスが配列で、要素がある場合
        if (Array.isArray(payload) && payload.length > 0) {
          console.log(`[Smaregi Debug] ${endpoint} first item fields:`, Object.keys(payload[0]));

          // 部門データとして使えそうな場合は、全件取得して返す
          const firstItem = payload[0];
          if (firstItem.divisionId || firstItem.departmentId || firstItem.categoryId) {
            console.log(`[Smaregi Debug] Using endpoint: ${endpoint}`);
            return await fetchAllDepartmentsFromEndpoint(endpoint);
          }
        }
      } else {
        console.log(`[Smaregi Debug] ${endpoint} failed with status ${response.status}`);
      }
    } catch (error) {
      console.log(`[Smaregi Debug] ${endpoint} error:`, error);
    }
  }

  // どのエンドポイントも使えない場合は空配列を返す
  console.warn('[Smaregi] No suitable department endpoint found');
  return [];
}

async function fetchAllDepartmentsFromEndpoint(endpoint: string): Promise<SmaregiDepartment[]> {
  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const contractId = config.contractId;
  const limit = 200;
  let offset = 0;

  const results: SmaregiDepartment[] = [];

  while (true) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(`${baseUrl}/${contractId}${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      break;
    }

    const payload = (await response.json()) as any[];

    if (payload.length === 0) {
      break;
    }

    payload.forEach((item: any) => {
      const id = item.divisionId ?? item.departmentId ?? item.categoryId;
      const name = item.divisionName ?? item.departmentName ?? item.categoryName ?? item.name;
      const parentId = item.parentDivisionId ?? item.parentDepartmentId ?? item.parentCategoryId;

      if (id && name) {
        results.push({
          departmentId: id,
          name: name,
          parentDepartmentId: parentId ?? null,
          level: typeof item.level === "number" ? item.level : null,
        });
      }
    });

    offset += payload.length;

    if (payload.length < limit) {
      break;
    }
  }

  return results;
}

export async function fetchProductsByCodes(codes: string[]): Promise<SmaregiProduct[]> {
  if (codes.length === 0) return [];

  const normalizedTargets = new Map<string, string>(); // normalizedCode -> original code
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
  const limit = 200;
  let offset = 0;

  const results: SmaregiProduct[] = [];
  const foundCodes = new Set<string>();

  while (true) {
    // まず全フィールドを取得してデバッグ（後で最適化）
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // POS API エンドポイント: /{contractId}/pos/products
    const response = await fetch(`${baseUrl}/${contractId}/pos/products?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Smaregi product request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as any;

    // デバッグ: 最初の商品のフィールドをログ出力
    if (payload.length > 0 && offset === 0) {
      console.log('[Smaregi Debug] First product fields:', Object.keys(payload[0]));
      console.log('[Smaregi Debug] First product data:', JSON.stringify(payload[0], null, 2));
    }

    const products = payload ?? [];
    if (products.length === 0) {
      break;
    }

    products.forEach((product: any) => {
      const productCode = product.productCode?.trim();
      if (!productCode) return;
      if (!normalizedTargets.has(productCode)) return;

      if (!foundCodes.has(productCode)) {
        results.push({
          productCode: normalizedTargets.get(productCode) ?? productCode,
          productId: product.productId ?? null,
          // 複数の可能性のあるフィールド名を試す
          departmentId: product.departmentId ?? product.divisionId ?? product.categoryId ?? null,
        });
        foundCodes.add(productCode);
      }
    });

    offset += products.length;

    if (products.length < limit) {
      break;
    }
    if (foundCodes.size === normalizedTargets.size) {
      break;
    }
  }

  return results;
}

export function clearSmaregiTokenCache() {
  tokenCache = null;
}
