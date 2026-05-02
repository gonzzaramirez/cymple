import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/env";
import { resolveTenantSlugFromHostname, resolveTenantSlugFromToken } from "@/lib/tenant";

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const pathname = params.path.join("/");
  const url = new URL(request.url);
  const target = `${API_BASE_URL}/${pathname}${url.search}`;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const tenantHost =
    request.headers.get("x-tenant-host") ??
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  const tenantSlug =
    request.headers.get("x-tenant-slug") ??
    resolveTenantSlugFromHostname(tenantHost) ??
    resolveTenantSlugFromToken(token);

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const bodyAllowed = !["GET", "HEAD"].includes(request.method);
  const forwarded = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(tenantHost ? { "X-Forwarded-Host": tenantHost } : {}),
      ...(request.headers.get("x-forwarded-proto")
        ? { "X-Forwarded-Proto": request.headers.get("x-forwarded-proto")! }
        : {}),
      ...(request.headers.get("x-forwarded-for")
        ? { "X-Forwarded-For": request.headers.get("x-forwarded-for")! }
        : {}),
      ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
    },
    body: bodyAllowed ? await request.text() : undefined,
    cache: "no-store",
  });

  const responseText = await forwarded.text();
  const contentType = forwarded.headers.get("content-type") ?? "application/json";
  return new NextResponse(responseText, {
    status: forwarded.status,
    headers: { "Content-Type": contentType },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, context);
}
