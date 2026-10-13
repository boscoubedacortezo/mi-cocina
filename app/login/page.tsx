import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  link: "El enlace no es válido o ha caducado. Pide uno nuevo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const initialError = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ChefHat className="size-10" aria-hidden />
        <h1 className="font-heading text-2xl font-semibold">Mi Cocina</h1>
        <p className="text-sm text-muted-foreground">
          Recetas, menú semanal y lista de la compra.
        </p>
      </div>
      <LoginForm initialError={initialError} />
    </main>
  );
}
