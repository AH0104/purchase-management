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

const PRODUCT_FIELDS = ["productId", "productCode", "departmentId", "divisionId", "categoryId"].join(",");

// 部門情報は商品から取得（部門一覧エンドポイントは存在しない）
export async function fetchAllDepartments(): Promise<SmaregiDepartment[]> {
  console.warn('[Smaregi] Department endpoints not available. Department names will be populated from product data.');
  return [];
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

        if (!foundCodes.has(productCode)) {
          results.push({
            productCode: originalCode,
            productId: product.productId ?? null,
            // 複数の可能性のあるフィールド名を試す
            departmentId: product.divisionId ?? product.departmentId ?? product.categoryId ?? null,
          });
          foundCodes.add(productCode);
        }
      }
    } catch (error) {
      console.warn(`[Smaregi] Error fetching product ${productCode}:`, error);
    }
  }

  return results;
}

export function clearSmaregiTokenCache() {
  tokenCache = null;
}
