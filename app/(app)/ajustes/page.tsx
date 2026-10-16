import type { Metadata } from "next";
import { LogOut } from "lucide-react";
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

      <section className="flex flex-col gap-3 rounded-xl border p-3">
        <h2 className="text-sm font-medium">Menú</h2>
        <MenuPreferencesForm initial={preferences} />
      </section>

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
