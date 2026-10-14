import { normalizeName } from "@/lib/shopping/normalize";

export type PlaceholderIcon =
  | "cake"
  | "soup"
  | "fish"
  | "drumstick"
  | "beef"
  | "salad"
  | "wheat"
  | "pizza"
  | "egg"
  | "bean"
  | "sandwich"
  | "pot"
  | "carrot"
  | "chef";

// First match wins, so more specific dishes come before generic ones.
const RULES: [PlaceholderIcon, string[]][] = [
  ["pizza", ["pizza"]],
  ["cake", ["postre", "tarta", "bizcocho", "dulce", "galleta", "flan", "natilla", "brownie", "pastel", "helado", "magdalena", "tortita"]],
  ["soup", ["sopa", "crema", "caldo", "gazpacho", "salmorejo", "pure", "cocido"]],
  ["fish", ["pescado", "merluza", "salmon", "bacalao", "atun", "marisco", "gamba", "pulpo", "calamar", "sardina", "lubina", "dorada"]],
  ["drumstick", ["pollo", "pavo", "ave"]],
  ["beef", ["carne", "ternera", "cerdo", "cordero", "hamburguesa", "chuleta", "filete", "albondiga", "lomo"]],
  ["egg", ["huevo", "tortilla", "revuelto"]],
  ["bean", ["legumbre", "lenteja", "garbanzo", "judia", "alubia", "hummus"]],
  ["pot", ["arroz", "paella", "risotto", "guiso", "estofado"]],
  ["wheat", ["pasta", "espagueti", "macarron", "lasana", "tallarin", "noqui", "fideo"]],
  ["salad", ["ensalada", "verdura", "vegetal", "hortaliza", "vegetariano"]],
  ["sandwich", ["bocadillo", "sandwich", "pan", "tostada", "wrap"]],
  ["carrot", ["zanahoria", "calabacin", "berenjena"]],
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable colour and icon for a recipe without a photo, from its name and tags. */
export function placeholderFor(recipe: { id: string; title: string; tags: string[] }) {
  const words = normalizeName(`${recipe.title} ${recipe.tags.join(" ")}`).split(" ");
  const haystack = new Set(words);
  const icon =
    RULES.find(([, keywords]) =>
      keywords.some((keyword) => haystack.has(normalizeName(keyword))),
    )?.[0] ?? "chef";
  return { icon, hue: hash(recipe.id) % 360 };
}
