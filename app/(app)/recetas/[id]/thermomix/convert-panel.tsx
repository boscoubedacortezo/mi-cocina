"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertToTm7 } from "./actions";

export function ConvertPanel({
  recipeId,
  defaultServings,
  replacing,
}: {
  recipeId: string;
  defaultServings: number;
  /** True when a version already exists: converting again replaces it. */
  replacing: boolean;
}) {
  const router = useRouter();
  const [servings, setServings] = useState(String(defaultServings));
  const [pending, startTransition] = useTransition();

  function convert() {
    if (
      replacing &&
      !window.confirm("Se sustituirá la versión actual, incluidos tus cambios. ¿Continuar?")
    ) {
      return;
    }
    const value = Number(servings.trim());
    startTransition(async () => {
      const result = await convertToTm7(recipeId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Receta convertida a TM7");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tm-servings">Raciones</Label>
        <Input
          id="tm-servings"
          inputMode="numeric"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          disabled={pending}
          className="w-28"
        />
        <p className="text-sm text-muted-foreground">
          Si no caben en el vaso (2,2 L), la IA las reducirá o las dividirá en tandas.
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        variant={replacing ? "outline" : "default"}
        onClick={convert}
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Adaptando a la TM7… (hasta un minuto)
          </>
        ) : (
          <>
            <Sparkles /> {replacing ? "Volver a convertir" : "Convertir a Thermomix"}
          </>
        )}
      </Button>
    </div>
  );
}
