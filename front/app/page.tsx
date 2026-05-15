import { redirect } from "next/navigation";
import { serverApiFetchIfAuthenticated } from "@/lib/server-api";

export default async function Home() {
  const me = await serverApiFetchIfAuthenticated<{ role: string }>(
    "auth/me",
  ).catch(() => null);

  if (!me) {
    redirect("/login");
  }

  if (me.role === "CENTER_ADMIN") {
    redirect("/center/home");
  }

  redirect("/home");
}
