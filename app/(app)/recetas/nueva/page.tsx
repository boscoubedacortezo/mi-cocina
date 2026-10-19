import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-server";
import { slotSchema } from "@/lib/menu/schema";
import { NewRecipeFlow } from "./new-recipe-flow";

export const metadata: Metadata = { title: "Nueva receta" };

// The AI import server actions run under this page: allow time for the model.
export const maxDuration = 60;

export default async function NewRecipePage({ searchParams }: PageProps<"/recetas/nueva">) {
  const { userId } = await requireUser();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  // Coming from an empty menu slot: the recipe will go into it once saved.
  const slot = slotSchema.safeParse({
    weekStart: first(params.semana),
    date: first(params.fecha),
    meal: first(params.comida),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Nueva receta</h1>
      <NewRecipeFlow
        userId={userId}
        menuSlot={slot.success ? slot.data : null}
        initialMode={first(params.modo) === "ia" ? "ia" : undefined}
      />
    </div>
  );
}
