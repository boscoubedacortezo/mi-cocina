import type { Course, MainIngredient, ShopSection, Unit } from "./constants";

/** Editable recipe content, as held by the form before it is saved. */
export type RecipeDraft = {
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  course: Course | null;
  main_ingredient: MainIngredient | null;
  source_url: string | null;
  notes: string | null;
  ingredients: {
    name: string;
    quantity: number | null;
    unit: Unit | null;
    shop_section: ShopSection;
    optional: boolean;
  }[];
  steps: { text: string }[];
};
