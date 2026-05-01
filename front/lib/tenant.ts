import { BASE_DOMAIN } from "./env";

const RESERVED_INFRA_SUBDOMAINS = new Set(["api", "www"]);

export function resolveTenantSlugFromHostname(hostname: string): string | null {
  const normalizedHost = hostname.toLowerCase().split(":")[0];
  const normalizedBase = BASE_DOMAIN.toLowerCase();

  if (!normalizedHost) return null;
  if (!normalizedBase) return null;
  if (normalizedHost === normalizedBase) return null;
  if (!normalizedHost.endsWith(`.${normalizedBase}`)) return null;

  const withoutBase = normalizedHost.slice(0, -(normalizedBase.length + 1));
  const slug = withoutBase.split(".").at(-1)?.trim() ?? "";
  if (!slug) return null;
  if (RESERVED_INFRA_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function resolveTenantSlugFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as {
      tenantSlug?: unknown;
    };
    return typeof json.tenantSlug === "string" ? json.tenantSlug : null;
  } catch {
    return null;
  }
}
