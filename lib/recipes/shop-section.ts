import type { ShopSection } from "./constants";

/*
 * Where an ingredient is bought, from its name. A dictionary of Spanish supermarket words, in
 * priority order (a "caldo de pollo" is pantry, not meat). Words of four letters or fewer must
 * match a whole word; longer ones match the start of a word, so plurals and genders work.
 * Anything it does not know is left to the AI (see lib/ai/classify-sections.ts).
 */

const RULES: { section: ShopSection; phrases?: string[]; words: string[] }[] = [
  {
    section: "Congelados",
    phrases: ["congelad", "helado", "hielo"],
    words: [],
  },
  {
    section: "Bebidas",
    phrases: ["agua mineral", "agua con gas", "agua de mar"],
    words: [
      "vino", "cerveza", "refresco", "zumo", "cava", "licor", "brandy", "coñac", "conac", "ron",
      "whisky", "sidra", "ginebra", "vodka", "champan", "tonica", "cola", "jerez", "oporto", "sake",
      "mirin", "amaretto", "marsala", "agua",
    ],
  },
  {
    // Cooked, canned, jarred or dried forms win over the fresh product they come from.
    section: "Despensa",
    phrases: [
      "leche de coco", "crema de coco", "leche condensada", "leche evaporada", "en lata", "lata de",
      "en conserva", "de conserva", "en aceite", "en bote", "bote de", "tomate frito",
      "tomate triturado", "tomate natural", "tomate pelado", "salsa de", "caldo de", "pasta de",
      "pan rallado", "frutos secos", "judias cocidas", "garbanzos cocidos", "lentejas cocidas",
      "leche en polvo", "queso en polvo", "ajo en polvo", "cebolla en polvo", "chocolate negro",
      "chocolate con leche", "chocolate blanco",
    ],
    words: [
      "caldo", "salsa", "concentrado", "pastilla", "conserva", "deshidratado", "deshidratada", "seco", "seca", "secos", "secas", "sal", "pimienta", "azucar", "harina",
      "maicena", "almidon", "levadura", "bicarbonato", "aceite", "vinagre", "mostaza", "mayonesa",
      "ketchup", "miel", "mermelada", "cacao", "chocolate", "galleta", "cereales", "avena", "arroz",
      "pasta", "macarron", "espagueti", "espagueti", "fideo", "tallarin", "lasana", "canelon",
      "noqui", "cuscus", "quinoa", "bulgur", "lenteja", "garbanzo", "alubia", "judion", "fabada",
      "almendra", "nuez", "avellana", "pistacho", "piñon", "cacahuete", "anacardo", "pipa", "sesamo",
      "pasa", "datil", "orejon", "comino", "pimenton", "oregano", "canela", "curcuma", "nuez moscada",
      "laurel", "clavo", "azafran", "curry", "jengibre en polvo", "vainilla", "colorante", "gelatina",
      "agar", "wasabi", "soja", "tahini", "sirope", "stevia", "edulcorante", "ñora", "ñoras",
      "alcaparra", "aceituna", "pepinillo", "encurtido", "tortita", "obleas", "fecula", "polenta",
      "semola", "gofio", "sazonador", "especias", "especia", "perejil seco", "tomillo seco",
    ],
  },
  {
    section: "Pescado",
    words: [
      "pescado", "merluza", "bacalao", "salmon", "atun", "bonito", "lubina", "dorada", "gamba",
      "langostino", "mejillon", "almeja", "calamar", "chipiron", "pulpo", "sepia", "sardina",
      "anchoa", "boqueron", "rape", "trucha", "marisco", "cigala", "gallo", "rodaballo", "lenguado",
      "emperador", "pez", "bacalao", "berberecho", "navaja", "vieira", "carabinero", "centollo",
      "nécora", "necora", "langosta", "caballa", "jurel", "palometa", "surimi", "huevas", "caviar",
    ],
  },
  {
    section: "Carne",
    words: [
      "pollo", "pavo", "ternera", "cerdo", "cordero", "conejo", "jamon", "chorizo", "bacon", "beicon",
      "panceta", "lomo", "solomillo", "carne", "hamburguesa", "salchicha", "morcilla", "butifarra",
      "costilla", "pechuga", "muslo", "contramuslo", "magro", "pato", "longaniza", "mortadela",
      "fiambre", "secreto", "presa", "cabrito", "buey", "vaca", "chuleta", "entrecot", "carrillera",
      "rabo", "oreja", "codillo", "paleta", "lacon", "sobrasada", "foie", "pate", "albondiga", "picada",
      "cochinillo", "cecina", "salchichon", "lomito", "filete", "jarrete", "cabeza de lomo",
    ],
  },
  {
    section: "Lácteos y huevos",
    words: [
      "leche", "nata", "queso", "yogur", "yogurt", "mantequilla", "huevo", "requeson", "mascarpone",
      "ricotta", "kefir", "cuajada", "natillas", "flan", "burrata", "mozzarella", "parmesano",
      "feta", "gouda", "emmental", "cheddar", "philadelphia", "margarina", "clara", "yema",
      "gruyere", "cabrales", "roquefort", "provolone", "halloumi", "skyr", "tofu",
    ],
  },
  {
    section: "Panadería",
    words: [
      "pan", "baguette", "barra", "bollo", "croissant", "tostada", "hojaldre", "masa", "wrap",
      "pita", "focaccia", "ciabatta", "brioche", "magdalena", "bizcocho", "picatostes", "biscote",
      "regañas", "regana", "rosquilla", "empanadilla", "obleas de pan", "tortilla de trigo",
      "tortilla de maiz", "base de pizza", "pizza",
    ],
  },
  {
    section: "Frutas y verduras",
    words: [
      "cebolla", "cebolleta", "ajo", "tomate", "patata", "zanahoria", "pimiento", "calabacin",
      "calabaza", "berenjena", "lechuga", "espinaca", "acelga", "puerro", "apio", "champiñon",
      "champinon", "seta", "brocoli", "coliflor", "judia", "guisante", "pepino", "rabano",
      "remolacha", "esparrago", "alcachofa", "col", "repollo", "nabo", "boniato", "maiz", "canonigo",
      "rucula", "endibia", "escarola", "lombarda", "chirivia", "hinojo", "cardo", "borraja",
      "habas", "haba", "perejil", "cilantro", "albahaca", "menta", "hierbabuena", "cebollino",
      "eneldo", "romero", "tomillo", "salvia", "estragon", "manzana", "pera", "platano", "naranja",
      "limon", "lima", "mandarina", "pomelo", "fresa", "frambuesa", "arandano", "mora", "uva",
      "melon", "sandia", "melocoton", "nectarina", "albaricoque", "ciruela", "kiwi", "mango",
      "piña", "aguacate", "coco", "granada", "higo", "cereza", "papaya", "caqui", "chirimoya",
      "membrillo", "fruta", "verdura", "ensalada", "brotes", "germinados", "jengibre", "chalota",
      "guindilla", "chile", "pimiento", "aji", "tirabeques", "okra", "soja fresca", "edamame",
    ],
  },
];

/** Lower case, no accents, single spaces. */
export function normalizeIngredient(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesWord(token: string, word: string) {
  if (word.length <= 4) return token === word || token === `${word}s` || token === `${word}es`;
  return token.startsWith(word);
}

/** The section for an ingredient name, or null when the dictionary does not know it. */
export function guessShopSection(name: string): ShopSection | null {
  const text = normalizeIngredient(name);
  if (!text) return null;
  const tokens = text.split(" ");
  for (const rule of RULES) {
    if (rule.phrases?.some((phrase) => text.includes(phrase))) return rule.section;
    const hit = rule.words.some((word) =>
      word.includes(" ") ? text.includes(word) : tokens.some((token) => matchesWord(token, word)),
    );
    if (hit) return rule.section;
  }
  return null;
}
