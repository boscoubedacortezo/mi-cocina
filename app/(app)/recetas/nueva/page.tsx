import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-server";
import { RecipeForm } from "../_components/recipe-form";

export const metadata: Metadata = { title: "Nueva receta" };

export default async function NewRecipePage() {
  const { userId } = await requireUser();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Nueva receta</h1>
      <RecipeForm userId={userId} />
    </div>
  );
}
