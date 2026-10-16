import type { Metadata } from "next";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { getMenuPreferences } from "@/lib/settings/queries";
import { createClient } from "@/lib/supabase/server";
import { MenuPreferencesForm } from "./menu-preferences-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const preferences = await getMenuPreferences();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Ajustes</h1>

      <details className="group rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Preferencias de menú</span>
            <span className="text-xs text-muted-foreground">
              Raciones, comidas, repeticiones y cómo elige la IA
            </span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t p-3">
          <MenuPreferencesForm initial={preferences} />
        </div>
      </details>

      <section className="flex flex-col gap-3 rounded-xl border p-3">
        <h2 className="text-sm font-medium">Cuenta</h2>
        {email && (
          <p className="text-sm text-muted-foreground">
            Sesión iniciada como <span className="font-medium text-foreground">{email}</span>
          </p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <LogOut /> Cerrar sesión
          </Button>
        </form>
      </section>
    </div>
  );
}
