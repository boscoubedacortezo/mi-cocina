import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChefHat, Clock, ExternalLink, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatIngredient, formatMinutes } from "@/lib/recipes/format";
import { getRecipe } from "@/lib/recipes/queries";
import { hasThermomixVersion } from "@/lib/thermomix/queries";
import { DeleteRecipeButton } from "../_components/delete-recipe-button";

export async function generateMetadata({
  params,
}: PageProps<"/recetas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const recipe = await getRecipe(id);
  return { title: recipe.title };
}

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

      {recipe.image_url && (
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
          <ChefHat /> {hasTm7 ? "Ver versión TM7" : "Convertir a TM7"}
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

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Ingredientes</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingredientes.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {recipe.ingredients.map((item) => (
              <li key={item.id} className="px-3 py-2">
                {formatIngredient(item)}
                {item.optional && (
                  <span className="text-sm text-muted-foreground"> (opcional)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Preparación</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pasos.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {recipe.steps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <p className="whitespace-pre-line">{step.text}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

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
