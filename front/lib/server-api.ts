import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { API_BASE_URL } from "./env";
import { getAuthToken } from "./server-auth";
import { resolveTenantContext } from "./tenant";

type RequestInitWithMethod = RequestInit & { method?: string };

type ServerApiRequestOptions = {
  redirectOnUnauthorized?: boolean;
};

async function performServerApiFetch<T>(
  path: string,
  init?: RequestInitWithMethod,
  options?: ServerApiRequestOptions,
): Promise<T | null> {
  const redirectOnUnauthorized = options?.redirectOnUnauthorized ?? true;
  const token = await getAuthToken();

  if (!token) {
    if (redirectOnUnauthorized) {
      redirect("/login");
    }
    return null;
  }

  const incomingHeaders = await headers();
  const { tenantHost, tenantSlug } = resolveTenantContext({
    tenantHostHeader: incomingHeaders.get("x-tenant-host"),
    forwardedHostHeader: incomingHeaders.get("x-forwarded-host"),
    hostHeader: incomingHeaders.get("host"),
    tenantSlugHeader: incomingHeaders.get("x-tenant-slug"),
  });

  if (!tenantSlug) {
    throw new Error(
      "No se pudo resolver el tenant desde el host. Configura NEXT_PUBLIC_BASE_DOMAIN y accede por un subdominio vÃ¡lido.",
    );
  }

  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(tenantHost ? { "X-Tenant-Host": tenantHost } : {}),
      ...(tenantHost ? { "X-Forwarded-Host": tenantHost } : {}),
      ...(incomingHeaders.get("x-forwarded-proto")
        ? { "X-Forwarded-Proto": incomingHeaders.get("x-forwarded-proto")! }
        : {}),
      ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    if (redirectOnUnauthorized) {
      redirect("/login");
    }
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Error en la API");
  }

  return response.json() as Promise<T>;
}

export async function serverApiFetch<T>(
  path: string,
  init?: RequestInitWithMethod,
): Promise<T> {
  const result = await performServerApiFetch<T>(path, init);
  if (result === null) {
    throw new Error("Request unauthorized");
  }
  return result;
}

export async function serverApiFetchIfAuthenticated<T>(
  path: string,
  init?: RequestInitWithMethod,
): Promise<T | null> {
  return performServerApiFetch<T>(path, init, {
    redirectOnUnauthorized: false,
  });
}
