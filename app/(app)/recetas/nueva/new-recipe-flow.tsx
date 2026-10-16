"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareImage } from "@/lib/images";
import { RECIPE_IMAGES_BUCKET, type SourceType } from "@/lib/recipes/constants";
import { extractCookidooUrl, isCookidooUrl } from "@/lib/recipes/cookidoo-url";
import type { RecipeDraft } from "@/lib/recipes/draft";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { RecipeForm } from "../_components/recipe-form";
import {
  importFromImages,
  importFromText,
  importFromUrl,
  type ImportResult,
} from "./actions";

type Mode = "manual" | "texto" | "url" | "foto";

const MODES: { id: Mode; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "texto", label: "Texto" },
  { id: "url", label: "URL" },
  { id: "foto", label: "Foto" },
];

const MAX_PHOTOS = 3;

type Imported = {
  draft: RecipeDraft;
  sourceType: SourceType;
  note: string | null;
  /** A photo that comes with the recipe (Cookidoo's), saved along with it. */
  imageUrl: string | null;
  /** Changes on every import so the form remounts with the new data. */
  id: number;
};

type Photo = { id: string; blob: Blob; ext: string; url: string };

export function NewRecipeFlow({ userId }: { userId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [imported, setImported] = useState<Imported | null>(null);
  const [pending, startTransition] = useTransition();

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleResult(result: ImportResult) {
    if (!result.ok) {
      const { existingId } = result;
      toast.error(
        result.error,
        existingId
          ? {
              duration: 10_000,
              action: { label: "Abrir", onClick: () => router.push(`/recetas/${existingId}`) },
            }
          : undefined,
      );
      return;
    }
    setImported({
      draft: result.draft,
      sourceType: result.sourceType,
      note: result.note,
      imageUrl: result.imageUrl,
      id: Date.now(),
    });
    window.scrollTo({ top: 0 });
  }

  function importText() {
    startTransition(async () => handleResult(await importFromText(text)));
  }

  function importUrl() {
    startTransition(async () => handleResult(await importFromUrl(url)));
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast.error(`Máximo ${MAX_PHOTOS} fotos por receta.`);
    const added: Photo[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const { blob, ext } = await prepareImage(file);
        added.push({ id: crypto.randomUUID(), blob, ext, url: URL.createObjectURL(blob) });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Foto no válida.");
      }
    }
    setPhotos((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((p) => p.id !== id);
    });
  }

  function importPhotos() {
    startTransition(async () => {
      const storage = createClient().storage.from(RECIPE_IMAGES_BUCKET);
      const paths: string[] = [];
      for (const photo of photos) {
        const path = `${userId}/import/${crypto.randomUUID()}.${photo.ext}`;
        const { error } = await storage.upload(path, photo.blob, {
          contentType: photo.blob.type || undefined,
        });
        if (error) {
          await storage.remove(paths);
          toast.error("No se pudo subir la foto. Inténtalo de nuevo.");
          return;
        }
        paths.push(path);
      }
      handleResult(await importFromImages(paths));
    });
  }

  if (imported) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => setImported(null)}
        >
          <ArrowLeft /> Volver a importar
        </Button>
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
        >
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p>
              <strong>Receta importada con IA.</strong> Revisa los datos antes de
              guardar: cantidades, unidades y pasos pueden tener errores.
            </p>
            {imported.note && <p className="text-muted-foreground">{imported.note}</p>}
          </div>
        </div>
        <RecipeForm
          key={imported.id}
          userId={userId}
          sourceType={imported.sourceType}
          cancelHref="/recetas"
          importedImageUrl={imported.imageUrl}
          initial={{ ...imported.draft, image_path: null, image_url: null }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Cómo añadir la receta" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            disabled={pending}
            onClick={() => setMode(id)}
            className={cn(
              "rounded-md py-1.5 text-sm text-muted-foreground transition-colors",
              mode === id && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "manual" && (
        <RecipeForm userId={userId} cancelHref="/recetas" />
      )}

      {mode === "texto" && (
        <section className="flex flex-col gap-3">
          <Label htmlFor="import-text">Pega la receta</Label>
          <Textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            maxLength={30_000}
            placeholder="Ingredientes, pasos… tal como la tengas (de un mensaje, un PDF, una web…)."
            disabled={pending}
          />
          <ImportButton pending={pending} disabled={text.trim().length < 40} onClick={importText} />
        </section>
      )}

      {mode === "url" && (
        <section className="flex flex-col gap-3">
          <Label htmlFor="import-url">Dirección de la receta</Label>
          <Input
            id="import-url"
            // Not type="url": what Cookidoo copies is a sentence with the link in it.
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              // Pasting the whole shared text leaves just the link in the field.
              const text = e.clipboardData.getData("text");
              const link = extractCookidooUrl(text);
              if (link !== text.trim() && isCookidooUrl(link)) {
                e.preventDefault();
                setUrl(link);
              }
            }}
            placeholder="https:// (o el texto que copia Cookidoo)"
            disabled={pending}
          />
          <p className="text-sm text-muted-foreground">
            Sirve también para recetas de Cookidoo: se guardan con foto, ingredientes y tiempos
            (los pasos los tienes allí). Algunas webs bloquean la descarga; si falla, pega el
            texto de la receta.
          </p>
          <ImportButton pending={pending} disabled={!url.trim()} onClick={importUrl} />
        </section>
      )}

      {mode === "foto" && (
        <section className="flex flex-col gap-3">
          <Label>Fotos de la receta</Label>
          <p className="text-sm text-muted-foreground">
            De un libro o de un papel. Hasta {MAX_PHOTOS} fotos si la receta ocupa varias
            páginas (en orden). Se usan solo para leer el texto y se borran después.
          </p>
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <li key={photo.id} className="relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Foto ${index + 1}`} className="aspect-square w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1 right-1"
                    onClick={() => removePhoto(photo.id)}
                    disabled={pending}
                    aria-label={`Quitar foto ${index + 1}`}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_PHOTOS && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              <Camera /> {photos.length ? "Añadir otra foto" : "Hacer o elegir foto"}
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <ImportButton pending={pending} disabled={photos.length === 0} onClick={importPhotos} />
        </section>
      )}
    </div>
  );
}

function ImportButton({
  pending,
  disabled,
  onClick,
}: {
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" size="lg" disabled={pending || disabled} onClick={onClick}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Leyendo la receta… (unos segundos)
        </>
      ) : (
        <>
          <Sparkles /> Importar con IA
        </>
      )}
    </Button>
  );
}
