import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRecipe } from "@/lib/recipes/queries";
import { buildIngredientsBlock, resolveTotalMinutes } from "@/lib/thermomix/cookidoo";
import { getThermomixVersion } from "@/lib/thermomix/queries";
import { CookidooGuide } from "./guide";

export const metadata: Metadata = { title: "Pasar a Cookidoo" };

export default async function CookidooGuidePage({
  params,
}: PageProps<"/recetas/[id]/thermomix/cookidoo">) {
  const { id } = await params;
  const [recipe, version] = await Promise.all([getRecipe(id), getThermomixVersion(id)]);
  if (!version) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/recetas/${recipe.id}/thermomix`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Versión TM7
      </Link>
      <CookidooGuide
        versionId={version.id}
        title={recipe.title}
        servings={version.servings ?? recipe.servings}
        prepMinutes={recipe.prep_minutes}
        totalMinutes={resolveTotalMinutes(recipe.prep_minutes, recipe.cook_minutes, version.steps)}
        ingredients={buildIngredientsBlock(version.ingredients_text).split("\n").filter(Boolean)}
        steps={version.steps}
      />
    </div>
  );
}
