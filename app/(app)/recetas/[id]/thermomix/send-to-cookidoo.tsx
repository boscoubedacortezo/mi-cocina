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
  photoOwned,
}: {
  payload: string;
  recipeId: string;
  hasPhoto: boolean;
  /** False for covers taken from someone else's video: they go marked as not the user's. */
  photoOwned: boolean;
}) {
  // The photo is read as soon as the section is open, so copying is instant afterwards
  // (the browser only lets a copy happen right inside the tap).
  const [photo, setPhoto] = useState<{
    data: string;
    type: string;
    kb: number;
  } | null>(null);
  const [photoState, setPhotoState] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");

  async function loadPhoto() {
    if (!hasPhoto || photoState !== "idle") return;
    setPhotoState("loading");
    const result = await getRecipePhoto(recipeId);
    if (!result.ok) {
      toast.error(`La foto no se incluirá: ${result.error}`);
      setPhotoState("failed");
      return;
    }
    setPhoto({ data: result.data, type: result.type, kb: result.kb });
    setPhotoState("ready");
  }

  const recipeText = () =>
    photo
      ? serializeRecipe({
          ...JSON.parse(payload),
          photo: { data: photo.data, type: photo.type, owned: photoOwned },
        })
      : payload;

  return (
    <details
      className="rounded-xl border p-3"
      onToggle={(e) => e.currentTarget.open && loadPhoto()}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Enviar a Cookidoo automáticamente (experimental)
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong>Una sola vez:</strong> arrastra este botón a tu barra de
            marcadores.
            <div className="mt-2">
              <BookmarkletLink />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Si no puedes arrastrarlo, crea un marcador a mano y pega como
              dirección el código que copia el botón de abajo.
            </p>
          </li>
          <li>
            <strong>Cada receta:</strong> copia esta receta aquí.
            {hasPhoto && (
              <p className="mt-1 text-xs text-muted-foreground">
                {photoState === "loading" && "Preparando la foto…"}
                {photoState === "ready" &&
                  photo &&
                  `Se enviará también la foto de la receta (${photo.kb} KB).`}
                {photoState === "failed" && "La foto no se enviará."}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={photoState === "loading"}
                onClick={() => copyText(recipeText(), "Receta para Cookidoo")}
              >
                <Send /> Copiar para enviar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(buildBookmarklet(), "Código del marcador")
                }
              >
                Copiar el marcador
              </Button>
            </div>
          </li>
          <li>
            Abre <strong>cookidoo.es</strong> con tu sesión y pulsa el marcador.
            La receta se crea en «Creadas por mí» y se abre para que la revises.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Es una vía no oficial: Cookidoo puede cambiarla y dejar de funcionar.
          Todo ocurre en tu navegador con tu sesión; Mi Cocina no guarda ni
          conoce tus credenciales.
        </p>
      </div>
    </details>
  );
}
