/** Checks the ingredient dictionary against names a recipe really has. */
import { guessShopSection } from "@/lib/recipes/shop-section";

const cases: [string, string | null][] = [
  ["cebolla", "Frutas y verduras"], ["Cebollas moradas", "Frutas y verduras"], ["diente de ajo", "Frutas y verduras"],
  ["tomate maduro", "Frutas y verduras"], ["patatas", "Frutas y verduras"], ["limón", "Frutas y verduras"],
  ["perejil fresco", "Frutas y verduras"], ["aguacate", "Frutas y verduras"], ["pimiento rojo", "Frutas y verduras"],
  ["pechuga de pollo", "Carne"], ["solomillo de cerdo", "Carne"], ["jamón serrano", "Carne"], ["panceta", "Carne"],
  ["merluza", "Pescado"], ["gambas peladas", "Pescado"], ["bonito", "Pescado"], ["chipirones", "Pescado"],
  ["huevo", "Lácteos y huevos"], ["leche entera", "Lácteos y huevos"], ["queso rallado", "Lácteos y huevos"],
  ["mantequilla", "Lácteos y huevos"], ["nata para cocinar", "Lácteos y huevos"], ["yogur natural", "Lácteos y huevos"],
  ["pan", "Panadería"], ["pan de molde", "Panadería"], ["masa de hojaldre", "Panadería"],
  ["harina de trigo", "Despensa"], ["arroz bomba", "Despensa"], ["aceite de oliva virgen extra", "Despensa"],
  ["sal", "Despensa"], ["pimienta negra molida", "Despensa"], ["azúcar", "Despensa"], ["lentejas", "Despensa"],
  ["macarrones", "Despensa"], ["caldo de pollo", "Despensa"], ["tomate frito", "Despensa"], ["salsa de soja", "Despensa"],
  ["atún en lata", "Despensa"], ["leche de coco", "Despensa"], ["pan rallado", "Despensa"], ["pimentón dulce", "Despensa"],
  ["almendras", "Despensa"], ["chocolate negro", "Despensa"], ["vino blanco", "Bebidas"], ["cerveza", "Bebidas"],
  ["guisantes congelados", "Congelados"], ["helado de vainilla", "Congelados"],
  ["panceta curada", "Carne"], ["pantalla", null], ["xyzzy", null], ["", null],
];

let failed = 0;
for (const [name, expected] of cases) {
  const got = guessShopSection(name);
  if (got !== expected) { failed++; console.log("FAIL", JSON.stringify(name), "->", got, "(expected", expected + ")"); }
}
console.log(`${cases.length - failed}/${cases.length} ok`);
process.exit(failed ? 1 : 0);
