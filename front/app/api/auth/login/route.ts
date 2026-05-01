import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/env";
import { resolveTenantSlugFromHostname } from "@/lib/tenant";

export async function POST(request: Request) {
  const body = await request.json();
  const url = new URL(request.url);
  const tenantHeaderSlug = request.headers.get("x-tenant-slug");
  const tenantSlug =
    tenantHeaderSlug ?? resolveTenantSlugFromHostname(url.hostname);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
    },
    body: JSON.stringify({
      ...body,
      ...(tenantSlug ? { tenantSlug } : {}),
    }),
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const store = await cookies();
  // Cookie host-only to isolate session per tenant subdomain.
  store.set(AUTH_COOKIE, payload.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json(payload);
}
