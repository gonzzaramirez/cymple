const rawApiBase = process.env.API_BASE_URL ?? "";
if (process.env.NODE_ENV === "production" && !rawApiBase.trim()) {
  throw new Error(
    "API_BASE_URL es obligatorio en producción. Configuralo en tu archivo .env o en la plataforma de deploy.",
  );
}

export const API_BASE_URL = rawApiBase.trim() || "http://localhost:3080/v1";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://cymple.online";

export const AUTH_COOKIE = "medagenda_token";

const rawBaseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";
if (process.env.NODE_ENV === "production" && !rawBaseDomain.trim()) {
  throw new Error(
    "NEXT_PUBLIC_BASE_DOMAIN es obligatorio en producción para resolver tenants por subdominio.",
  );
}

export const BASE_DOMAIN = rawBaseDomain.trim();
