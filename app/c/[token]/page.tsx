import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedRecipe } from "@/lib/share/queries";
import {
  buildRecipeJsonLd,
  resolveCookMinutes,
  stepWithSettings,
} from "@/lib/share/recipe-jsonld";
import { verifyShareToken } from "@/lib/share/token";
import { formatMinutes } from "@/lib/recipes/format";

// Public page for Cookidoo's "Importar receta": no session, gated by a signed,
// expiring token. Kept out of search engines and without a referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedRecipePage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const recipeId = verifyShareToken(token);
  if (!recipeId) notFound();
  const recipe = await getSharedRecipe(recipeId);
  if (!recipe) notFound();

  const cook = resolveCookMinutes(recipe);
  // "<" is escaped so recipe text can never close the script tag.
  const jsonLd = JSON.stringify(buildRecipeJsonLd(recipe)).replace(/</g, "\\u003c");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">{recipe.title}</h1>
        {recipe.description && <p className="text-muted-foreground">{recipe.description}</p>}
        <p className="text-sm text-muted-foreground">
          {recipe.servings} raciones
          {recipe.prepMinutes ? ` · Preparación ${formatMinutes(recipe.prepMinutes)}` : ""}
          {cook ? ` · Cocción ${formatMinutes(cook)}` : ""}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">Ingredientes</h2>
        <ul className="list-disc pl-5">
          {recipe.ingredients.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">Preparación</h2>
        <ol className="list-decimal pl-5">
          {recipe.steps.map((step, index) => (
            <li key={index} className="mb-2">
              {stepWithSettings(step)}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
