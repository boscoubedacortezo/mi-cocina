/**
 * Typical weight in grams of one unit of a product, as sold in Spain. Used to
 * merge "2 ud" and "200 g" of the same product into whole pieces to buy.
 * Keys are `normalizeName` results. Products not listed are never converted.
 */
export const UNIT_WEIGHTS: Record<string, number> = {
  cebolla: 200,
  patata: 200,
  boniato: 250,
  tomate: 150,
  zanahoria: 100,
  calabacin: 250,
  pimiento: 180,
  berenjena: 300,
  pepino: 250,
  puerro: 150,
  remolacha: 150,
  lechuga: 350,
  ajo: 50, // a whole head
  limon: 100,
  lima: 70,
  naranja: 200,
  mandarina: 80,
  manzana: 180,
  pera: 180,
  platano: 120,
  kiwi: 80,
  melocoton: 150,
  aguacate: 200,
  huevo: 60,
};
