import {
  Bean,
  Beef,
  Cake,
  Carrot,
  ChefHat,
  CookingPot,
  Drumstick,
  EggFried,
  Fish,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { placeholderFor, type PlaceholderIcon } from "@/lib/recipes/placeholder";
import { cn } from "@/lib/utils";

const ICONS: Record<PlaceholderIcon, LucideIcon> = {
  cake: Cake,
  soup: Soup,
  fish: Fish,
  drumstick: Drumstick,
  beef: Beef,
  salad: Salad,
  wheat: Wheat,
  pizza: Pizza,
  egg: EggFried,
  bean: Bean,
  sandwich: Sandwich,
  pot: CookingPot,
  carrot: Carrot,
  chef: ChefHat,
};

/** Soft tinted card with a dish icon, shown when a recipe has no photo. */
export function RecipePlaceholder({
  recipe,
  className,
}: {
  recipe: { id: string; title: string; tags: string[] };
  className?: string;
}) {
  const { icon, hue } = placeholderFor(recipe);
  const Icon = ICONS[icon];
  return (
    <div
      aria-hidden
      style={{ "--h": hue } as React.CSSProperties}
      className={cn(
        "flex items-center justify-center bg-[hsl(var(--h)_60%_90%)] text-[hsl(var(--h)_45%_38%)] dark:bg-[hsl(var(--h)_28%_20%)] dark:text-[hsl(var(--h)_45%_72%)]",
        className,
      )}
    >
      <Icon className="size-1/4 min-w-8 max-w-20" strokeWidth={1.5} />
    </div>
  );
}
