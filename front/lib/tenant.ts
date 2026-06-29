import { BASE_DOMAIN } from "./env";

const RESERVED_INFRA_SUBDOMAINS = new Set(["api", "www", "apitest"]);

function normalizeHostLike(value: string): string {
  return value.toLowerCase().split(",")[0]?.trim().split(":")[0] ?? "";
}

function normalizeSlug(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}

export function resolveTenantSlugFromHostname(hostname: string): string | null {
  const normalizedHost = normalizeHostLike(hostname);
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

  const IS_PROD = process.env.NODE_ENV === "production";

export function resolveTenantContext(options: {
  tenantHostHeader?: string | null;
  forwardedHostHeader?: string | null;
  hostHeader?: string | null;
  fallbackHost?: string | null;
  tenantSlugHeader?: string | null;
}) {
  const tenantHost = [
    options.tenantHostHeader,
    options.forwardedHostHeader,
    options.hostHeader,
    options.fallbackHost,
  ]
    .map((value) => (value ? value.split(",")[0]?.trim() ?? "" : ""))
    .find(Boolean) ?? "";

  const hostname = normalizeHostLike(tenantHost);
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  const tenantSlug =
    normalizeSlug(options.tenantSlugHeader) ??
    resolveTenantSlugFromHostname(hostname) ??
    // Fallback local: si no podemos resolver tenant en desarrollo, usar "demo"
    (!IS_PROD ? "demo" : null);

  return {
    tenantHost,
    hostname,
    tenantSlug,
  };
}
