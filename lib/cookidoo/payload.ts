import { formatTime } from "@/lib/thermomix/cookidoo";
import type { ThermomixStep } from "@/lib/thermomix/schema";

/*
 * Request bodies for Cookidoo's own "Creadas por mí" editor, as captured from the
 * browser (see the memory note cookidoo-editor-payloads). Unofficial: it is meant to
 * run inside the user's logged-in cookidoo.es tab, never from our server.
 */

/** Icons from Cookidoo's font (private-use characters) that its step text embeds. */
const GLYPH = {
  dough: "",
  spoon: "",
  reverse: "",
  turbo: "",
  rice: "",
  warmUp: "",
  blend: "",
} as const;

type Setting = {
  text: string;
  type: "TTS" | "MODE";
  name?: string;
  data: Record<string, unknown>;
};

export type CookidooStep = {
  type: "STEP";
  text: string;
  annotations: {
    type: Setting["type"] | "INGREDIENT";
    name?: string;
    data: Record<string, unknown>;
    position: { offset: number; length: number };
  }[];
};

const celsius = (value: number | "Varoma") => ({
  value: value === "Varoma" ? "varoma" : String(value),
  unit: "C",
});

/**
 * The machine setting of a step: its text as Cookidoo writes it and the annotation
 * data. Preset modes are used only where their exact shape was captured; anything else
 * goes through the manual settings, which accept every combination.
 */
export function buildSetting(step: ThermomixStep): Setting | null {
  const { time_seconds: time, temperature, speed } = step;
  const plain = !step.reverse && !step.accessory;

  if (step.mode === "arroz") {
    return { text: `Cocción de arroz ${GLYPH.rice}`, type: "MODE", name: "rice_cooker", data: {} };
  }
  if (step.mode === "amasar" && time !== null) {
    return {
      text: `Amasar ${GLYPH.dough}/${formatTime(time)}`,
      type: "MODE",
      name: "dough",
      data: { time },
    };
  }
  if (speed === "turbo") {
    const seconds = Math.min(time ?? 1, 2);
    return {
      text: `Turbo ${GLYPH.turbo}/${formatTime(seconds)}`,
      type: "MODE",
      name: "turbo",
      data: { time: seconds },
    };
  }
  // Only speed 6 was captured for Triturar, and only the spoon for Calentar.
  if (time !== null && temperature === null && speed === "6" && plain) {
    return {
      text: `Triturar ${GLYPH.blend}/${formatTime(time)}`,
      type: "MODE",
      name: "blend",
      data: { speed: "6", time },
    };
  }
  if (
    time === null &&
    typeof temperature === "number" &&
    temperature <= 90 &&
    speed === "cuchara" &&
    plain
  ) {
    return {
      text: `Calentar ${GLYPH.warmUp}/${temperature}°C`,
      type: "MODE",
      name: "warm_up",
      data: { speed: "soft", temperature: celsius(temperature) },
    };
  }

  if (time === null && temperature === null && speed === null) return null;

  const parts: string[] = [];
  const data: Record<string, unknown> = {};
  if (speed) data.speed = speed === "cuchara" ? "soft" : speed;
  if (step.reverse && speed) data.direction = "CCW";
  if (time !== null) data.time = time;
  if (temperature !== null) data.temperature = celsius(temperature);

  if (time !== null) parts.push(formatTime(time));
  if (temperature !== null) parts.push(temperature === "Varoma" ? "Varoma" : `${temperature}°C`);
  if (step.reverse && speed) parts.push(GLYPH.reverse);
  if (speed) {
    // Half speeds were not captured: written with a comma as the Spanish UI does.
    parts.push(`velocidad ${speed === "cuchara" ? GLYPH.spoon : speed.replace(".", ",")}`);
  }
  return { text: parts.join("/"), type: "TTS", data };
}

const isLetter = (char: string | undefined) => char !== undefined && /\p{L}/u.test(char);

/**
 * Where each ingredient line appears, word for word, in the prose. Longer lines go first
 * so one that contains another wins, and nothing overlaps or matches inside a word.
 */
function findIngredients(prose: string, ingredients: string[]) {
  const found: { offset: number; line: string }[] = [];
  const lines = [...new Set(ingredients)].filter((line) => line.length >= 3);
  for (const line of lines.sort((a, b) => b.length - a.length)) {
    let from = 0;
    while (from <= prose.length - line.length) {
      const offset = prose.indexOf(line, from);
      if (offset === -1) break;
      const end = offset + line.length;
      const clean = !isLetter(prose[offset - 1]) && !isLetter(prose[end]);
      const free = found.every((hit) => end <= hit.offset || offset >= hit.offset + hit.line.length);
      if (clean && free) {
        found.push({ offset, line });
        break;
      }
      from = offset + 1;
    }
  }
  return found.sort((a, b) => a.offset - b.offset);
}

/**
 * A step: the prose with its ingredients linked, then (as the editor does) the setting
 * text appended and annotated.
 */
export function buildStep(step: ThermomixStep, ingredients: string[] = []): CookidooStep {
  const prose = step.text.trim();
  const annotations: CookidooStep["annotations"] = findIngredients(prose, ingredients).map(
    ({ offset, line }) => ({
      type: "INGREDIENT",
      data: { description: line },
      position: { offset, length: line.length },
    }),
  );
  const setting = buildSetting(step);
  if (!setting) return { type: "STEP", text: prose, annotations };

  const { text, type, name, data } = setting;
  annotations.push({
    type,
    ...(name ? { name } : {}),
    data,
    position: { offset: prose.length + 1, length: text.length },
  });
  return { type: "STEP", text: `${prose} ${text}`, annotations };
}

export type CookidooRecipeInput = {
  title: string;
  servings: number;
  prepMinutes: number | null;
  totalMinutes: number | null;
  ingredientsText: string;
  steps: ThermomixStep[];
};

/** The calls the editor makes, in order: create, then PATCH each part of the recipe. */
export function buildCookidooRecipe(input: CookidooRecipeInput) {
  const ingredientLines = input.ingredientsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const prep = (input.prepMinutes ?? 0) * 60;
  const total = Math.max((input.totalMinutes ?? 0) * 60, prep);
  return {
    // Cookidoo's title limit is 120 characters.
    create: { recipeName: input.title.trim().slice(0, 120) },
    patches: [
      { totalTime: total, prepTime: prep, yield: { value: input.servings, unitText: "portion" } },
      {
        ingredients: ingredientLines.map((text) => ({ type: "INGREDIENT", text })),
      },
      { instructions: input.steps.map((step) => buildStep(step, ingredientLines)) },
    ],
    // The value for the TM7 was not captured: sent last and allowed to fail.
    optionalPatches: [{ tools: ["TM7"] }],
  };
}

/** The photo travels inside the copied recipe: base64 of the stored image. */
export type CookidooPhoto = {
  data: string;
  type: string;
  /** Sent as `isImageOwnedByUser`: false unless the user says the photo is theirs. */
  owned: boolean;
};

export type CookidooRecipe = ReturnType<typeof buildCookidooRecipe> & {
  photo?: CookidooPhoto | null;
};
