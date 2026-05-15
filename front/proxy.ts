/**
 * Next.js 16+: el límite de red antes del App Router vive en `proxy.ts` con `export function proxy`
 * (no uses `middleware.ts`; la convención se renombró — ver docs de Next.js "middleware-to-proxy").
 * Inyecta x-tenant-host y x-tenant-slug según el hostname y NEXT_PUBLIC_BASE_DOMAIN.
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantSlugFromHostname } from "@/lib/tenant";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const hostname = request.nextUrl.hostname.toLowerCase();
  const tenantSlug = resolveTenantSlugFromHostname(hostname);

  requestHeaders.set("x-tenant-host", hostname);
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
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
