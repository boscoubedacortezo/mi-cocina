"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteThermomixVersion } from "./actions";

export function DeleteVersionButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "¿Eliminar la versión Thermomix? Se pierden sus ajustes y tus ediciones. La receta original no se toca.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            const result = await deleteThermomixVersion(recipeId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Versión Thermomix eliminada");
            router.push(`/recetas/${recipeId}`);
          });
        }}
      >
        <Trash2 /> {pending ? "Eliminando…" : "Eliminar versión Thermomix"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Si no te convence, la receta sigue como la tenías para hacerla de la forma tradicional.
      </p>
    </div>
  );
}
