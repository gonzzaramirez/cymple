export const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:3080/v1";

export const AUTH_COOKIE = "medagenda_token";

const rawBaseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";
if (process.env.NODE_ENV === "production" && !rawBaseDomain.trim()) {
  throw new Error(
    "NEXT_PUBLIC_BASE_DOMAIN es obligatorio en producción para resolver tenants por subdominio.",
  );
}

export const BASE_DOMAIN = rawBaseDomain.trim();
