import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "./env";

export async function getAuthToken() {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value;
}

export async function requireAuthToken() {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}
