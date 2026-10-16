"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildBookmarklet, serializeRecipe } from "@/lib/cookidoo/runner";
import { toast } from "sonner";
import { getRecipePhoto } from "./actions";
import { copyText } from "@/lib/clipboard";

/** The bookmarklet's href is set after mount: React refuses `javascript:` URLs in markup. */
function BookmarkletLink() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", buildBookmarklet());
  }, []);
  return (
    <a
      ref={ref}
      href="#"
      onClick={(event) => event.preventDefault()}
      draggable
      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary"
    >
      <Bookmark className="size-4" aria-hidden /> Enviar a Cookidoo
    </a>
  );
}

/** Experimental, unofficial: sends the recipe through the user's own Cookidoo tab. */
export function SendToCookidoo({
  payload,
  recipeId,
  hasPhoto,
}: {
  payload: string;
  recipeId: string;
  hasPhoto: boolean;
}) {
  // The photo is read when the switch is turned on, so copying is instant afterwards
  // (the browser only lets a copy happen right inside the tap).
  const [withPhoto, setWithPhoto] = useState(false);
  const [owned, setOwned] = useState(false);
  const [photo, setPhoto] = useState<{ data: string; type: string; kb: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function togglePhoto(on: boolean) {
    setWithPhoto(on);
    if (!on) return;
    if (photo) return;
    setLoading(true);
    const result = await getRecipePhoto(recipeId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setWithPhoto(false);
      return;
    }
    setPhoto({ data: result.data, type: result.type, kb: result.kb });
  }

  const recipeText = () =>
    withPhoto && photo
      ? serializeRecipe({
          ...JSON.parse(payload),
          photo: { data: photo.data, type: photo.type, owned },
        })
      : payload;

  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Enviar a Cookidoo automáticamente (experimental)
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong>Una sola vez:</strong> arrastra este botón a tu barra de marcadores.
            <div className="mt-2">
              <BookmarkletLink />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Si no puedes arrastrarlo, crea un marcador a mano y pega como dirección el
              código que copia el botón de abajo.
            </p>
          </li>
          <li>
            <strong>Cada receta:</strong> copia esta receta aquí.
            {hasPhoto && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-lg border p-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withPhoto}
                    disabled={loading}
                    onChange={(e) => togglePhoto(e.target.checked)}
                  />
                  <span>
                    Incluir la foto de la receta
                    {loading && " (leyendo…)"}
                    {withPhoto && photo && ` (${photo.kb} KB)`}
                  </span>
                </label>
                {withPhoto && (
                  <label className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                    <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
                    La foto es mía (si no, se marca en Cookidoo como de otra persona)
                  </label>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => copyText(recipeText(), "Receta para Cookidoo")}
              >
                <Send /> Copiar para enviar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(buildBookmarklet(), "Código del marcador")}
              >
                Copiar el marcador
              </Button>
            </div>
          </li>
          <li>
            Abre <strong>cookidoo.es</strong> con tu sesión y pulsa el marcador. La receta se
            crea en «Creadas por mí» y se abre para que la revises.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Es una vía no oficial: Cookidoo puede cambiarla y dejar de funcionar. Todo ocurre
          en tu navegador con tu sesión; Mi Cocina no guarda ni conoce tus credenciales.
        </p>
      </div>
    </details>
  );
}
