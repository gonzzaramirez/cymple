import { redirect } from "next/navigation";
import { getAuthToken } from "@/lib/server-auth";

export default async function Home() {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }
  redirect("/home");
}
