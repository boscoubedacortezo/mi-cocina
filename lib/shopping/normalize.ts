const ARTICLES = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas"]);

function singularize(word: string) {
  if (word.length <= 3) return word;
  if (word.endsWith("ces")) return `${word.slice(0, -3)}z`; // lápices -> lapiz
  if (/[lnrdzj]es$/.test(word)) return word.slice(0, -2); // limones -> limon
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Key used to decide that two ingredient names are the same product: ignores
 * case, accents, articles and plurals ("Tomates" = "tomate", "limón" = "limones").
 */
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !ARTICLES.has(word))
    .map(singularize)
    .join(" ");
}

// Words that only describe how tap water is used in a recipe.
const TAP_WATER_WORDS = new Set([
  "templada", "templado", "tibia", "tibio", "fria", "frio", "caliente", "hirviendo",
  "hirviente", "helada", "fresca", "del", "grifo", "natural", "potable", "filtrada", "filtrado",
]);

/**
 * "agua", "agua templada", "agua del grifo"... are not bought. Bottled or flavoured
 * waters ("agua mineral", "agua de coco", "agua de azahar") still are.
 */
export function isTapWater(name: string) {
  const [first, ...rest] = normalizeName(name).split(" ");
  return first === "agua" && rest.every((word) => TAP_WATER_WORDS.has(word));
}
