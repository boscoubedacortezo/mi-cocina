import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThermomixIcon } from "@/components/equipment-icons";
import { EquipmentChips } from "@/components/equipment-chips";
import { MainIngredientBadge } from "@/components/main-ingredient-badge";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { COURSE_LABELS } from "@/lib/recipes/constants";
import { formatMinutes } from "@/lib/recipes/format";
import type { RecipeSummary } from "@/lib/recipes/queries";

/** A recipe in the list: photo (with where it comes from), title, time, how it is cooked, category. */
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const total = formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
  return (
      <Link
        href={`/recetas/${recipe.id}`}
        className="flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:bg-accent/40"
      >
        <div className="relative">
          {recipe.image_url ? (
            <div className="relative aspect-[16/9] bg-muted">
              <Image
                src={recipe.image_url}
                alt=""
                fill
                sizes="(min-width: 672px) 336px, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <RecipePlaceholder recipe={recipe} className="aspect-[16/9]" />
          )}
          {/* Where it comes from goes on the photo; how it is cooked goes below. */}
          {recipe.from_cookidoo && (
            <span
              className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[#00ac46] px-2 py-1 text-xs font-medium text-white shadow-sm"
              title="Receta de Cookidoo: los pasos están allí"
            >
              <ThermomixIcon className="size-3.5" aria-hidden />
              Cookidoo
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <h2 className="font-heading leading-snug font-medium">
            {recipe.title}
          </h2>
          {total && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {total}
            </p>
          )}
          <EquipmentChips
            thermomix={recipe.has_thermomix || recipe.from_cookidoo}
            equipment={recipe.equipment}
          />
          {(recipe.course || recipe.main_ingredient) && (
            <div className="flex flex-wrap gap-1">
              {recipe.course && <Badge>{COURSE_LABELS[recipe.course]}</Badge>}
              {recipe.main_ingredient && (
                <MainIngredientBadge value={recipe.main_ingredient} />
              )}
            </div>
          )}
        </div>
      </Link>
  );
}
