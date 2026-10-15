import { Badge } from "@/components/ui/badge";
import { MAIN_INGREDIENT_LABELS, type MainIngredient } from "@/lib/recipes/constants";
import { MAIN_INGREDIENT_COLORS } from "@/lib/recipes/colors";
import { cn } from "@/lib/utils";

export function MainIngredientBadge({
  value,
  className,
}: {
  value: MainIngredient;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", MAIN_INGREDIENT_COLORS[value], className)}
    >
      {MAIN_INGREDIENT_LABELS[value]}
    </Badge>
  );
}
