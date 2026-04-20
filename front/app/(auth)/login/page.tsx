import { redirect } from "next/navigation";
import { LoginForm } from "./components/login-form";
import { getAuthToken } from "@/lib/server-auth";

export default async function LoginPage() {
  const token = await getAuthToken();
  if (token) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">
            MedAgenda
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Gestión de agenda y pacientes para profesionales
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
