import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/env";
import { resolveTenantSlugFromHostname } from "@/lib/tenant";

function resolveTenantSlugFromRequest(request: Request): string | null {
  const explicitTenant = request.headers.get("x-tenant-slug");
  if (explicitTenant) return explicitTenant.trim().toLowerCase();

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const url = new URL(request.url);
  const hostname = (forwardedHost ?? host ?? url.hostname).toLowerCase();
  return resolveTenantSlugFromHostname(hostname);
}

export async function POST(request: Request) {
  const body = await request.json();
  const tenantSlug = resolveTenantSlugFromRequest(request);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
    },
    body: JSON.stringify(body),
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
