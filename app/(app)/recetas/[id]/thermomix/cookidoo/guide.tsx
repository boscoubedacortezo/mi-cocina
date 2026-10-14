"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Check, Copy, Fan, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { formatMinutes } from "@/lib/recipes/format";
import { stepSettings } from "@/lib/thermomix/cookidoo";
import { helixPlan } from "@/lib/thermomix/helix";
import type { ThermomixStep } from "@/lib/thermomix/schema";
import { cn } from "@/lib/utils";

/** Cookidoo limits recipe titles to 120 characters. */
const COOKIDOO_TITLE_MAX = 120;

// Progress lives in localStorage so it survives switching between apps.
function useChecklist(storageKey: string) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(storageKey, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(storageKey, notify);
    };
  }, [storageKey]);

  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );

  const done = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const write = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Private mode: progress just isn't remembered.
      }
      window.dispatchEvent(new Event(storageKey));
    },
    [storageKey],
  );

  return {
    done,
    toggle: (id: string) => {
      const next = new Set(done);
      if (!next.delete(id)) next.add(id);
      write(next);
    },
    reset: () => write(new Set()),
  };
}

type Segment = { kind: "text" | "ingredient"; value: string };

/**
 * Splits a step into what you type and what you insert with the scale: the
 * ingredient lines the text names verbatim are the ones to link.
 */
function segmentStep(text: string, ingredients: string[]): Segment[] {
  const lower = text.toLowerCase();
  const hits = ingredients
    .map((line) => ({ start: lower.indexOf(line.toLowerCase()), length: line.length }))
    .filter((hit) => hit.start !== -1)
    .sort((a, b) => a.start - b.start || b.length - a.length);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, hit.start) });
    segments.push({ kind: "ingredient", value: text.slice(hit.start, hit.start + hit.length) });
    cursor = hit.start + hit.length;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}

function Item({
  id,
  done,
  onToggle,
  children,
  copy,
}: {
  id: string;
  done: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  copy?: { text: string; label: string };
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", done && "bg-muted/50")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecho"}
        onClick={() => onToggle(id)}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
          done && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {done && <Check className="size-4" aria-hidden />}
      </button>
      <div className={cn("min-w-0 flex-1", done && "text-muted-foreground")}>{children}</div>
      {copy && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => copyText(copy.text, copy.label)}
          aria-label={`Copiar ${copy.label.toLowerCase()}`}
        >
          <Copy />
        </Button>
      )}
    </div>
  );
}

export function CookidooGuide({
  versionId,
  title,
  servings,
  prepMinutes,
  totalMinutes,
  ingredients,
  steps,
}: {
  versionId: string;
  title: string;
  servings: number;
  prepMinutes: number | null;
  totalMinutes: number | null;
  ingredients: string[];
  steps: ThermomixStep[];
}) {
  const { done, toggle, reset } = useChecklist(`cookidoo-guide:${versionId}`);
  const total = 1 + ingredients.length + steps.length;
  const count = done.size;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Pasar a Cookidoo</h1>
        <p className="text-muted-foreground">
          En la app de Cookidoo: <em>Creadas por mí</em> → crear receta. Copia cada elemento con su
          botón y márcalo cuando esté hecho.
        </p>
        <p className="text-sm text-muted-foreground">
          Cookidoo no deja pegar en los pasos, así que cada paso se monta a mano, en este orden:
        </p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          <li>Texto normal: lo escribes en «Describir paso».</li>
          <li>
            <Scale className="inline size-4 align-text-bottom" aria-hidden /> Ingrediente: lo eliges
            en la balanza (lo inserta y lo vincula).
          </li>
          <li>
            <Fan className="inline size-4 align-text-bottom" aria-hidden /> Ajustes: los pones con
            la hélice (los inserta al final).
          </li>
        </ul>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {Math.min(count, total)} de {total} hechos
          </span>
          {count > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Empezar de nuevo
            </Button>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">1. Título y datos</h2>
        <Item id="title" done={done.has("title")} onToggle={toggle} copy={{ text: title, label: "Título" }}>
          <p className="text-sm text-muted-foreground">Título</p>
          <p className="font-medium">{title}</p>
          {title.length > COOKIDOO_TITLE_MAX && (
            <p className="text-sm text-destructive">
              Tiene {title.length} caracteres y Cookidoo admite {COOKIDOO_TITLE_MAX}: acórtalo al pegarlo.
            </p>
          )}
        </Item>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Raciones", String(servings)],
            ["Preparación", formatMinutes(prepMinutes) ?? "—"],
            ["Tiempo total", formatMinutes(totalMinutes) ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">2. Ingredientes</h2>
        {ingredients.map((line, index) => (
          <Item
            key={index}
            id={`i${index}`}
            done={done.has(`i${index}`)}
            onToggle={toggle}
            copy={{ text: line, label: "Ingrediente" }}
          >
            {line}
          </Item>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">3. Pasos</h2>
        {steps.map((step, index) => {
          const helix = helixPlan(step);
          const summary = stepSettings(step).join(" / ");
          return (
            <Item
              key={index}
              id={`s${index}`}
              done={done.has(`s${index}`)}
              onToggle={toggle}
            >
              <p className="text-sm text-muted-foreground">Paso {index + 1}</p>
              <p className="leading-8">
                {segmentStep(step.text, ingredients).map((segment, i) =>
                  segment.kind === "text" ? (
                    <span key={i}>{segment.value}</span>
                  ) : (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-sm font-medium"
                    >
                      <Scale className="size-3.5" aria-hidden />
                      {segment.value}
                    </span>
                  ),
                )}
                {summary && (
                  <>
                    {" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-sm font-medium">
                      <Fan className="size-3.5" aria-hidden />
                      {summary}
                    </span>
                  </>
                )}
              </p>
              {(helix.fields.length > 0 || helix.note) && (
                <div className="mt-3">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Fan className="size-3.5" aria-hidden /> Hélice → pestaña{" "}
                    <strong className="text-foreground">{helix.tab}</strong>
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-2">
                    {helix.fields.map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-secondary px-2 py-1">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {helix.note && <p className="mt-2 text-sm text-muted-foreground">{helix.note}</p>}
                </div>
              )}
            </Item>
          );
        })}
      </section>
    </div>
  );
}
