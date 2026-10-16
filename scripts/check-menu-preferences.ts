/** Checks reading preferences, the repeat window and the prompt built from them. */
import { enforcePlan, type PlanRequest } from "@/lib/ai/plan-menu";
import { buildPlanMenuSystem } from "@/lib/ai/prompts/plan-menu";
import {
  DEFAULT_MENU_PREFERENCES,
  menuPreferencesSchema,
  parseMenuPreferences,
} from "@/lib/menu/preferences";

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(ok ? "ok  " : "FAIL", name, ok ? "" : JSON.stringify(detail));
};

// Reading: lenient.
check("empty row = defaults", JSON.stringify(parseMenuPreferences({})) === JSON.stringify(DEFAULT_MENU_PREFERENCES));
check("null = defaults", JSON.stringify(parseMenuPreferences(null)) === JSON.stringify(DEFAULT_MENU_PREFERENCES));
const partial = parseMenuPreferences({ servings: 2, noRepeatDays: 999, meals: ["cena"], notes: "  sin cordero " });
check("keeps valid, defaults invalid", partial.servings === 2 && partial.noRepeatDays === 7 && partial.meals.join() === "cena" && partial.notes === "sin cordero", partial);
check("meals keep their order", parseMenuPreferences({ meals: ["cena", "comida"] }).meals.join() === "comida,cena");

// Saving: strict.
check("strict rejects 0 servings", !menuPreferencesSchema.safeParse({ ...DEFAULT_MENU_PREFERENCES, servings: 0 }).success);
check("strict rejects no meals", !menuPreferencesSchema.safeParse({ ...DEFAULT_MENU_PREFERENCES, meals: [] }).success);
check("strict rejects NaN", !menuPreferencesSchema.safeParse({ ...DEFAULT_MENU_PREFERENCES, noRepeatDays: NaN }).success);
check("strict accepts defaults", menuPreferencesSchema.safeParse(DEFAULT_MENU_PREFERENCES).success);

// Repeat window.
const request = (days: number, extra: Partial<PlanRequest> = {}): PlanRequest => ({
  recipes: [],
  fixed: [{ key: "2026-10-12|comida", recipeId: "A" }],
  empty: ["2026-10-13|comida", "2026-10-19|comida", "2026-10-20|cena", "2026-10-14|cena"],
  exclude: [],
  nearby: [{ date: "2026-10-22", recipeId: "B" }],
  preferences: { ...DEFAULT_MENU_PREFERENCES, noRepeatDays: days },
  ...extra,
});
const recipes = [{ id: "A" }, { id: "B" }, { id: "C" }];
const run = (days: number, proposed: [string, string | null][]) =>
  [...enforcePlan(proposed.map(([slot, recipe_id]) => ({ slot, recipe_id })), request(days), recipes)];

check("7 days: A again next day is rejected", run(7, [["2026-10-13|comida", "A"]]).length === 0);
check("7 days: A exactly 7 days later is allowed", run(7, [["2026-10-19|comida", "A"]]).length === 1);
check("7 days: B 2 days from nearby week is rejected", run(7, [["2026-10-20|cena", "B"]]).length === 0);
check("7 days: C twice in the window keeps the first", run(7, [["2026-10-13|comida", "C"], ["2026-10-14|cena", "C"]]).length === 1);
check("14 days: A a week later is rejected", run(14, [["2026-10-19|comida", "A"]]).length === 0);
check("0 days: repeating is allowed on other days", run(0, [["2026-10-13|comida", "A"], ["2026-10-14|cena", "A"]]).length === 2);
check("0 days: same date still rejected", enforcePlan([{ slot: "2026-10-12|cena", recipe_id: "A" }], request(0, { empty: ["2026-10-12|cena"] }), recipes).size === 0);
check("unknown recipe and slot ignored", run(7, [["2026-10-13|comida", "ZZZ"], ["2030-01-01|cena", "C"]]).length === 0);
check("excluded recipe is never proposed", enforcePlan([{ slot: "2026-10-13|comida", recipe_id: "C" }], request(0, { exclude: ["C"] }), recipes).size === 0);

// Prompt.
const prompt = (overrides: object) => buildPlanMenuSystem({ ...DEFAULT_MENU_PREFERENCES, ...overrides });
check("prompt states the window", prompt({ noRepeatDays: 14 }).includes("menos de 14 días"));
check("prompt allows repeating at 0", prompt({ noRepeatDays: 0 }).includes("permite repetir"));
check("prompt lists minimums", prompt({ minPerWeek: { pescado: 2, legumbres: 1, verdura: 0 } }).includes("al menos 2 de pescado, al menos 1 de legumbres"));
check("prompt drops the course rule when off", !prompt({ onlyMains: false }).includes('preferentemente recetas de tipo "principal"'));
check("prompt has no leftover 'undefined'", !prompt({}).includes("undefined"));
process.exit(failed ? 1 : 0);
