"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRecipe } from "../actions";

export function DeleteRecipeButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className="size-10 text-destructive"
      aria-label="Borrar receta"
      title="Borrar receta"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`¿Borrar «${title}»? No se puede deshacer.`)) return;
        startTransition(async () => {
          const result = await deleteRecipe(id);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      <Trash2 className="size-5" />
    </Button>
  );
}
