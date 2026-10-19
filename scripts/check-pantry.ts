import { inPantry, pantryKey } from "@/lib/shopping/pantry";
let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (got !== want) { failed++; console.log("FAIL", name, got, "!=", want); }
};
const pantry = ["sal", "aceite", "pimienta negra", "agua"].map(pantryKey);
eq("exact", inPantry("sal", pantry), true);
eq("plural/case", inPantry("Sal", pantry), true);
eq("starts with entry", inPantry("sal gruesa", pantry), true);
eq("aceite de oliva", inPantry("Aceite de oliva virgen extra", pantry), true);
eq("accents", inPantry("pimienta negra molida", pantry), true);
eq("salsa is not sal", inPantry("salsa de soja", pantry), false);
eq("pimienta alone is not pimienta negra", inPantry("pimienta", pantry), false);
eq("other", inPantry("harina", pantry), false);
eq("empty", inPantry("", pantry), false);
eq("empty pantry", inPantry("sal", []), false);
eq("key", pantryKey("  Aceite   de  Oliva "), "aceite de oliva");
console.log(failed ? `${failed} failed` : "all ok");
process.exit(failed ? 1 : 0);
