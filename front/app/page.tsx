import { redirect } from "next/navigation";
import { getAuthToken } from "@/lib/server-auth";

function getRoleFromToken(token: string): string | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(
      Buffer.from(normalized, "base64").toString("utf8"),
    ) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }

  const role = getRoleFromToken(token);
  if (role === "CENTER_ADMIN") {
    redirect("/center/home");
  }
  redirect("/home");
}
