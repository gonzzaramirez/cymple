import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { API_BASE_URL } from "./env";
import { getAuthToken } from "./server-auth";
import { resolveTenantSlugFromHostname } from "./tenant";

type RequestInitWithMethod = RequestInit & { method?: string };

export async function serverApiFetch<T>(
  path: string,
  init?: RequestInitWithMethod,
): Promise<T> {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }
  const incomingHeaders = await headers();
  const forwardedHost = incomingHeaders.get("x-forwarded-host");
  const host = incomingHeaders.get("host");
  const tenantSlug = resolveTenantSlugFromHostname(forwardedHost ?? host ?? "");

  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(forwardedHost ? { "X-Forwarded-Host": forwardedHost } : {}),
      ...(incomingHeaders.get("x-forwarded-proto")
        ? { "X-Forwarded-Proto": incomingHeaders.get("x-forwarded-proto")! }
        : {}),
      ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Error en la API");
  }

  return response.json() as Promise<T>;
}
