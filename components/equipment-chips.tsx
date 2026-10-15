import { ChefHat } from "lucide-react";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/recipes/constants";
import { cn } from "@/lib/utils";

/**
 * How a recipe is cooked: the Thermomix first (it is derived, not stored), then the
 * rest. A recipe can have several and all of them show.
 */
export function EquipmentChips({
  thermomix,
  equipment,
  className,
}: {
  thermomix: boolean;
  equipment: Equipment[];
  className?: string;
}) {
  if (!thermomix && equipment.length === 0) return null;
  const chip = "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs";
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Cómo se cocina">
      {thermomix && (
        <li className={cn(chip, "font-medium text-foreground")}>
          <ChefHat className="size-3.5" aria-hidden />
          Thermomix
        </li>
      )}
      {equipment.map((item) => (
        <li key={item} className={cn(chip, "text-muted-foreground")}>
          {EQUIPMENT_LABELS[item]}
        </li>
      ))}
    </ul>
  );
}
