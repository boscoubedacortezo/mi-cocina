import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-server";
import { stockPhotosEnabled } from "@/lib/stock-photos";
import { NewRecipeFlow } from "./new-recipe-flow";

export const metadata: Metadata = { title: "Nueva receta" };

// The AI import server actions run under this page: allow time for the model.
export const maxDuration = 60;

export default async function NewRecipePage() {
  const { userId } = await requireUser();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-semibold">Nueva receta</h1>
      <NewRecipeFlow userId={userId} stockPhotos={stockPhotosEnabled()} />
    </div>
  );
}
