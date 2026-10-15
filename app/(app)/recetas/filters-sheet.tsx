"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Option = { value: string; label: string };

export type FilterValues = {
  tipo?: string;
  principal?: string;
  tag?: string;
  cocina?: string;
  origen?: string;
};

type Props = {
  /** Search text, kept when the filters change. */
  q?: string;
  current: FilterValues;
  courses: Option[];
  mains: Option[];
  tags: string[];
  /** How a recipe is cooked: Thermomix first, then the rest that exist. */
  cooking: Option[];
  hasCookidoo: boolean;
};

function Group({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: Option[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? undefined : option.value)}
            >
              <Badge variant={active ? "default" : "outline"} className="px-3 py-1 text-sm">
                {option.label}
              </Badge>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The sheet itself: mounted only while open, so it always starts from the URL's filters. */
function Sheet({
  q,
  current,
  courses,
  mains,
  tags,
  cooking,
  hasCookidoo,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FilterValues>(current);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const set = (key: keyof FilterValues) => (value: string | undefined) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  function apply() {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `/recetas?${qs}` : "/recetas");
    dialog.current?.close();
  }

  const anySelected = Object.values(values).some(Boolean);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-2xl border bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h2 className="font-heading font-semibold">Filtros</h2>
        <Button type="button" variant="ghost" size="icon" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <X />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <Group title="Tipo de plato" options={courses} selected={values.tipo} onSelect={set("tipo")} />
        <Group title="Ingrediente principal" options={mains} selected={values.principal} onSelect={set("principal")} />
        <Group title="Cómo se cocina" options={cooking} selected={values.cocina} onSelect={set("cocina")} />
        <Group
          title="Origen"
          options={hasCookidoo || values.origen ? [{ value: "cookidoo", label: "De Cookidoo" }] : []}
          selected={values.origen}
          onSelect={set("origen")}
        />
        <Group
          title="Etiquetas"
          options={tags.map((tag) => ({ value: tag, label: tag }))}
          selected={values.tag}
          onSelect={set("tag")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" size="lg" onClick={() => setValues({})} disabled={!anySelected}>
          Limpiar
        </Button>
        <Button type="button" size="lg" onClick={apply}>
          Ver recetas
        </Button>
      </div>
    </dialog>
  );
}

export function FiltersButton(props: Props) {
  const [open, setOpen] = useState(false);
  const count = Object.values(props.current).filter(Boolean).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={count ? `Filtros (${count} activos)` : "Filtros"}
      >
        <SlidersHorizontal /> Filtros
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {count}
          </span>
        )}
      </Button>
      {open && <Sheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
