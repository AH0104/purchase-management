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
const DEPARTMENT_FIELDS = ["departmentId", "departmentName", "parentDepartmentId", "level"].join(",");

type SmaregiDepartmentResponse = {
  departmentId?: string;
  departmentName?: string;
  parentDepartmentId?: string | null;
  level?: number | null;
};

export async function fetchAllDepartments(): Promise<SmaregiDepartment[]> {
  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const contractId = config.contractId;
  const limit = 200;
  let offset = 0;

  const results: SmaregiDepartment[] = [];

  while (true) {
    const params = new URLSearchParams({
      fields: DEPARTMENT_FIELDS,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // POS API エンドポイント: /{contractId}/pos/departments
    const response = await fetch(`${baseUrl}/${contractId}/pos/departments?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-Id": config.tenantId,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Smaregi departments request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as SmaregiDepartmentResponse[];

    if (payload.length === 0) {
      break;
    }

    payload.forEach((dept) => {
      if (dept.departmentId && dept.departmentName) {
        results.push({
          departmentId: dept.departmentId,
          name: dept.departmentName,
          parentDepartmentId: dept.parentDepartmentId ?? null,
          level: typeof dept.level === "number" ? dept.level : null,
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
    const params = new URLSearchParams({
      fields: PRODUCT_FIELDS,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // POS API エンドポイント: /{contractId}/pos/products
    const response = await fetch(`${baseUrl}/${contractId}/pos/products?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-Id": config.tenantId,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Smaregi product request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      products?: Array<{ productId?: string; productCode?: string | null; departmentId?: string | null }>;
    };

    const products = payload.products ?? [];
    if (products.length === 0) {
      break;
    }

    products.forEach((product) => {
      const productCode = product.productCode?.trim();
      if (!productCode) return;
      if (!normalizedTargets.has(productCode)) return;

      if (!foundCodes.has(productCode)) {
        results.push({
          productCode: normalizedTargets.get(productCode) ?? productCode,
          productId: product.productId ?? null,
          departmentId: product.departmentId ?? null,
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
