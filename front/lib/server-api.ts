import { redirect } from "next/navigation";
import { API_BASE_URL } from "./env";
import { getAuthToken } from "./server-auth";

type RequestInitWithMethod = RequestInit & { method?: string };

export async function serverApiFetch<T>(
  path: string,
  init?: RequestInitWithMethod,
): Promise<T> {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }

  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
