import { getSmaregiConfig } from "./config";
import { SmaregiDepartment, SmaregiProduct, SmaregiStockRecord } from "@/types/smaregi";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

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

async function smaregiGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const config = getSmaregiConfig();
  const token = await requestAccessToken();
  const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Tenant-Id": config.tenantId,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Smaregi GraphQL request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(`Smaregi GraphQL error: ${payload.errors.map((e) => e.message).join(", ")}`);
  }

  if (!payload.data) {
    throw new Error("Smaregi GraphQL response did not contain data");
  }

  return payload.data;
}

const DEPARTMENT_QUERY = /* GraphQL */ `
  query Departments($cursor: String) {
    departments(first: 200, after: $cursor) {
      edges {
        node {
          departmentId
          departmentName
          name
          parentDepartmentId
          level
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PRODUCT_FIELDS = ["productId", "productCode", "departmentId"].join(",");

type DepartmentEdge = {
  node: {
    departmentId?: string;
    departmentName?: string;
    name?: string;
    parentDepartmentId?: string | null;
    level?: number | null;
  };
  cursor: string;
};

type DepartmentPage = {
  departments?: {
    edges?: DepartmentEdge[];
    nodes?: DepartmentEdge["node"][];
    pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
  };
};

function normalizeDepartment(node: DepartmentEdge["node"]): SmaregiDepartment | null {
  const departmentId = node.departmentId ?? null;
  const name = node.name ?? node.departmentName ?? null;
  if (!departmentId || !name) {
    return null;
  }
  return {
    departmentId,
    name,
    parentDepartmentId: node.parentDepartmentId ?? null,
    level: typeof node.level === "number" ? node.level : null,
  };
}

export async function fetchAllDepartments(): Promise<SmaregiDepartment[]> {
  let cursor: string | null = null;
  const results: SmaregiDepartment[] = [];

  while (true) {
    const data = await smaregiGraphQL<DepartmentPage>(DEPARTMENT_QUERY, { cursor });
    const page = data.departments;
    if (!page) break;

    const nodes: DepartmentEdge["node"][] = page.edges?.map((edge) => edge.node) ?? page.nodes ?? [];
    nodes.forEach((node) => {
      const normalized = normalizeDepartment(node);
      if (normalized) {
        results.push(normalized);
      }
    });

    if (page.pageInfo?.hasNextPage && page.pageInfo.endCursor) {
      cursor = page.pageInfo.endCursor;
    } else {
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

    const response = await fetch(`${baseUrl}/products?${params.toString()}`, {
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
