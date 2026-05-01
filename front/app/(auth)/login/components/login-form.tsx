"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sileo } from "sileo";

const schema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: (() => {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (
          url.hostname === "test.cymple.com" ||
          (url.searchParams && url.searchParams.get("demo") === "1") ||
          url.pathname.split("/").includes("test")
        ) {
          return { email: "test@gmail.com", password: "test123" };
        }
      }
      return { email: "", password: "" };
    })(),
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);

    if (!response.ok) {
      sileo.error({ title: "No se pudo iniciar sesión" });
      return;
    }

    sileo.success({ title: "Sesión iniciada" });
    router.replace("/");
  }

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle>Ingresar</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <Button disabled={loading} className="w-full" type="submit" size="lg">
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
