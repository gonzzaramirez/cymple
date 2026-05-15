/**
 * Next.js 16+: el límite de red antes del App Router vive en `proxy.ts` con
 * `export function proxy` (no uses `middleware.ts`).
 *
 * Importante en producción detrás de reverse proxies: `request.nextUrl.hostname`
 * puede reflejar el host interno del contenedor. Por eso resolvemos el tenant
 * primero desde `x-forwarded-host` / `host` y recién después usamos el host de
 * fallback de Next.
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantContext } from "@/lib/tenant";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const { tenantHost, hostname, tenantSlug } = resolveTenantContext({
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
    hostHeader: request.headers.get("host"),
    fallbackHost: request.nextUrl.host,
    tenantSlugHeader: request.headers.get("x-tenant-slug"),
  });

  requestHeaders.set("x-tenant-host", tenantHost || hostname);
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  } else {
    requestHeaders.delete("x-tenant-slug");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
