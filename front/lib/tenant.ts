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
