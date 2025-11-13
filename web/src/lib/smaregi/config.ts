export type SmaregiConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  shopId: string;
  contractId: string;
  apiBaseUrl: string;
  authBaseUrl: string;
  scope: string;
};

const requiredEnv = [
  "SMAREGI_CLIENT_ID",
  "SMAREGI_CLIENT_SECRET",
  "SMAREGI_TENANT_ID",
  "SMAREGI_SHOP_ID",
] as const;

const fallbackApiBase = "https://api.smaregi.jp";
const fallbackAuthBase = "https://id.smaregi.jp";

function getEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value : "";
}

export function getSmaregiConfig(): SmaregiConfig {
  const missing = requiredEnv.filter((key) => !getEnv(key));
  if (missing.length > 0 && process.env.NODE_ENV !== "test") {
    console.warn(
      `[smaregi] Missing environment variables: ${missing.join(", ")}. ` +
        "Check your .env.local configuration."
    );
  }

  const contractId = getEnv("SMAREGI_CONTRACT_ID") || getEnv("SMAREGI_TENANT_ID");
  if (!contractId && process.env.NODE_ENV !== "test") {
    console.warn("[smaregi] Missing SMAREGI_CONTRACT_ID (or SMAREGI_TENANT_ID).");
  }

  return {
    clientId: getEnv("SMAREGI_CLIENT_ID"),
    clientSecret: getEnv("SMAREGI_CLIENT_SECRET"),
    tenantId: getEnv("SMAREGI_TENANT_ID"),
    shopId: getEnv("SMAREGI_SHOP_ID"),
    contractId,
    apiBaseUrl: getEnv("SMAREGI_API_BASE") || fallbackApiBase,
    authBaseUrl: getEnv("SMAREGI_AUTH_BASE") || fallbackAuthBase,
    scope: getEnv("SMAREGI_SCOPE") || "pos.inventory.read",
  };
}
