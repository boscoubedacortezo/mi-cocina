"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StockPhoto } from "@/lib/stock-photos";
import { searchStockPhotos } from "../photo-actions";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; photos: StockPhoto[] };

export function StockPhotoPicker({
  title,
  tags,
  onSelect,
  onClose,
}: {
  title: string;
  tags: string[];
  onSelect: (photo: StockPhoto) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const tagsKey = tags.join("|");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    searchStockPhotos({ title, tags: tagsKey ? tagsKey.split("|") : [] }).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", photos: result.photos }
          : { status: "error", message: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [title, tagsKey]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-2xl border bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h2 className="font-heading font-semibold">Fotos sugeridas</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {state.status === "loading" && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando fotos…
          </p>
        )}
        {state.status === "error" && (
          <p className="py-10 text-center text-sm text-destructive">{state.message}</p>
        )}
        {state.status === "ready" && state.photos.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay fotos para «{title}». Prueba a cambiar el título.
          </p>
        )}
        {state.status === "ready" && state.photos.length > 0 && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Son fotos genéricas, puede que no se parezcan a tu plato. Elige una si encaja.
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {state.photos.map((photo) => (
                <li key={photo.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(photo)}
                    className="overflow-hidden rounded-lg border"
                    aria-label={photo.alt ? `Usar foto: ${photo.alt}` : "Usar esta foto"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumb}
                      alt={photo.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </button>
                  <a
                    href={photo.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Foto de {photo.photographer} en Pexels
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-sm">
        <a
          href="https://www.pexels.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4"
        >
          Fotos proporcionadas por Pexels
        </a>
      </div>
    </dialog>
  );
}
