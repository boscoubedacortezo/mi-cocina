"use client";

import { useState, useTransition } from "react";
import { ClipboardCopy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCookidooLink } from "./actions";

type Link = { url: string; expiresAt: Date };

export function CookidooLink({ recipeId }: { recipeId: string }) {
  const [link, setLink] = useState<Link | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createCookidooLink(recipeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink({ url: result.url, expiresAt: new Date(result.expiresAt) });
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-heading text-lg font-semibold">Importar en Cookidoo con un enlace</h2>
      <p className="text-sm text-muted-foreground">
        Cookidoo → <em>Creadas por mí</em> → <em>Importar receta</em> y pega el enlace. Es una
        página pública de solo lectura que caduca en 24 horas; cualquiera que tenga el enlace
        podrá verla hasta entonces.
      </p>
      {link ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input value={link.url} readOnly aria-label="Enlace para Cookidoo" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copiar enlace">
              <ClipboardCopy />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Válido hasta{" "}
            {link.expiresAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}.
          </p>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={create} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Crear enlace
        </Button>
      )}
    </section>
  );
}
