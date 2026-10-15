import { singularize } from "@/lib/shopping/normalize";

// Shared by the recipe list and the menu picker, on the server and in the browser.

/** Lowercase, no accents, only letters and digits: "Calabacín, al horno!" -> "calabacin al horno". */
export function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Connectors that carry no meaning when searching: "ragout de pavo" = "ragout pavo".
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "con", "y", "a", "en", "al", "para", "un", "una"]);

/** The words of a query, normalized and singularized ("Tomates" -> "tomate"). */
export function parseQuery(raw: string) {
  const words = normalizeSearch(raw).split(" ").filter(Boolean);
  const meaningful = words.filter((word) => !STOPWORDS.has(word));
  // A query made only of connectors is still a query.
  return (meaningful.length ? meaningful : words).map(singularize);
}

export type SearchDoc = {
  title: string;
  description?: string | null;
  notes?: string | null;
  tags: string[];
  /** Category names ("Principal", "Pescado y marisco"). */
  labels: string[];
  ingredients: string[];
};

/**
 * null when the recipe does not match; otherwise a score, higher is better.
 * Every word must appear somewhere; words in the title count most.
 */
export function searchScore(doc: SearchDoc, tokens: string[]): number | null {
  if (tokens.length === 0) return 0;
  const title = normalizeSearch(doc.title);
  const tagsAndLabels = normalizeSearch([...doc.tags, ...doc.labels].join(" "));
  const rest = normalizeSearch([...doc.ingredients, doc.description ?? "", doc.notes ?? ""].join(" "));

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += title.split(" ").some((word) => word.startsWith(token)) ? 4 : 3;
    else if (tagsAndLabels.includes(token)) score += 2;
    else if (rest.includes(token)) score += 1;
    else return null;
  }
  return score;
}
