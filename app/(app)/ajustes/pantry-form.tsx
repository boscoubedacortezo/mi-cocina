"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToPantry, removeFromPantry } from "./actions";

/** The staples that never go in the shopping list. */
export function PantryForm({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    const text = name.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addToPantry(text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((current) =>
        current.includes(text.toLowerCase()) ? current : [...current, text.toLowerCase()].sort((a, b) => a.localeCompare(b, "es")),
      );
      setName("");
    });
  }

  function remove(item: string) {
    const previous = items;
    setItems(items.filter((entry) => entry !== item));
    startTransition(async () => {
      const result = await removeFromPantry(item);
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sal, aceite, pimienta…"
          aria-label="Ingrediente que siempre tienes"
          maxLength={60}
        />
        <Button type="submit" size="icon-lg" className="size-10 shrink-0" disabled={pending || !name.trim()} aria-label="Añadir a la despensa" title="Añadir a la despensa">
          <Plus className="size-5" />
        </Button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no has añadido nada.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-sm">
              <span className="capitalize">{item}</span>
              <button
                type="button"
                onClick={() => remove(item)}
                disabled={pending}
                className="flex size-6 items-center justify-center rounded-full hover:bg-muted"
                aria-label={`Quitar ${item} de la despensa`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
