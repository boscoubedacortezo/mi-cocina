import { EQUIPMENT_ICONS, ThermomixIcon } from "@/components/equipment-icons";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/recipes/constants";
import { cn } from "@/lib/utils";

/**
 * How a recipe is cooked. The Thermomix (derived, not stored: own version or Cookidoo)
 * shows as the green Thermomix icon; the traditional way (stored equipment) as grey chips.
 * "icons" is the compact form for cards; "labels" adds the names (recipe page).
 */
export function EquipmentChips({
  thermomix,
  equipment,
  variant = "icons",
  className,
}: {
  thermomix: boolean;
  equipment: Equipment[];
  variant?: "icons" | "labels";
  className?: string;
}) {
  if (!thermomix && equipment.length === 0) return null;
  const labels = variant === "labels";
  const chip = cn(
    "inline-flex h-6 items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground",
    labels ? "px-1.5 text-xs" : "w-6",
  );
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Cómo se cocina">
      {thermomix && (
        <li
          title="Thermomix"
          className={cn(
            "inline-flex h-6 items-center justify-center gap-1 rounded-md bg-[#00ac46]/15 font-medium text-[#008a38]",
            labels ? "px-1.5 text-xs" : "w-6",
          )}
        >
          <ThermomixIcon className="size-4" aria-hidden />
          {labels ? "Thermomix" : <span className="sr-only">Thermomix</span>}
        </li>
      )}
      {equipment.map((item) => {
        const Icon = EQUIPMENT_ICONS[item];
        return (
          <li key={item} title={EQUIPMENT_LABELS[item]} className={chip}>
            <Icon className="size-4" aria-hidden />
            {labels ? EQUIPMENT_LABELS[item] : <span className="sr-only">{EQUIPMENT_LABELS[item]}</span>}
          </li>
        );
      })}
    </ul>
  );
}
