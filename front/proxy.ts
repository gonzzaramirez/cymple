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
