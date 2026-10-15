import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChefHat, Clock, ExternalLink, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { formatMinutes } from "@/lib/recipes/format";
import { getRecipe } from "@/lib/recipes/queries";
import { hasThermomixVersion } from "@/lib/thermomix/queries";
import { DeleteRecipeButton } from "../_components/delete-recipe-button";
import { ScalableRecipe } from "./scalable-recipe";

export async function generateMetadata({
  params,
}: PageProps<"/recetas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const recipe = await getRecipe(id);
  return { title: recipe.title };
}

// The adapt server action runs under this page: allow time for the model.
export const maxDuration = 60;

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function RecipePage({ params }: PageProps<"/recetas/[id]">) {
  const { id } = await params;
  const [recipe, hasTm7] = await Promise.all([getRecipe(id), hasThermomixVersion(id)]);
  const prep = formatMinutes(recipe.prep_minutes);
  const cook = formatMinutes(recipe.cook_minutes);

  return (
    <article className="flex flex-col gap-6">
      <Link
        href="/recetas"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Recetas
      </Link>

      {recipe.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            sizes="(min-width: 672px) 672px, 100vw"
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      ) : (
        <RecipePlaceholder recipe={recipe} className="aspect-[16/9] rounded-xl" />
      )}

      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl leading-tight font-semibold">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-4" aria-hidden /> {recipe.servings} raciones
          </span>
          {prep && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> Prep. {prep}
            </span>
          )}
          {cook && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> Cocción {cook}
            </span>
          )}
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Link key={tag} href={`/recetas?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
        )}
        <Link
          href={`/recetas/${recipe.id}/thermomix`}
          className={buttonVariants({ size: "lg" })}
        >
          <ChefHat /> {hasTm7 ? "Ver versión Thermomix" : "Convertir a Thermomix"}
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/recetas/${recipe.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil /> Editar
          </Link>
          <DeleteRecipeButton id={recipe.id} title={recipe.title} />
        </div>
      </header>

      <ScalableRecipe
        recipeId={recipe.id}
        baseServings={recipe.servings}
        ingredients={recipe.ingredients}
        steps={recipe.steps}
      />

      {recipe.notes && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Notas</h2>
          <p className="whitespace-pre-line text-muted-foreground">{recipe.notes}</p>
        </section>
      )}

      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
        >
          <ExternalLink className="size-4" aria-hidden /> {hostname(recipe.source_url)}
        </a>
      )}
    </article>
  );
}
