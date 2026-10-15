import { ChefHat } from "lucide-react";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/recipes/constants";
import { cn } from "@/lib/utils";

/**
 * How a recipe is cooked. The Thermomix (derived, not stored: own version or Cookidoo)
 * is a filled chip; the traditional way (stored equipment) is grey chips after a
 * "Tradicional" label, so the two versions are never mixed up.
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
  const chip = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs";
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Cómo se cocina">
      {thermomix && (
        <li className={cn(chip, "bg-primary/15 font-medium text-primary")}>
          <ChefHat className="size-3.5" aria-hidden />
          Thermomix
        </li>
      )}
      {thermomix && equipment.length > 0 && (
        <li className="mx-0.5 h-4 w-px bg-border" role="presentation" />
      )}
      {equipment.length > 0 && (
        <li className="text-xs text-muted-foreground">Tradicional:</li>
      )}
      {equipment.map((item) => (
        <li key={item} className={cn(chip, "bg-muted text-muted-foreground")}>
          {EQUIPMENT_LABELS[item]}
        </li>
      ))}
    </ul>
  );
}
