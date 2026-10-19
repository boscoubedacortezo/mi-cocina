import { CookingPot, Microwave, Salad, Wind, type LucideIcon, type LucideProps } from "lucide-react";
import type { Equipment } from "@/lib/recipes/constants";

/*
 * Lucide has no oven, pan, griddle or pressure cooker, so these are drawn
 * with the same grid and stroke (24px, 2px, round) to sit next to its icons.
 */
function svg(children: React.ReactNode): LucideIcon {
  function Icon({ size = 24, strokeWidth = 2, className, ...rest }: LucideProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {children}
      </svg>
    );
  }
  return Icon as LucideIcon;
}

const Oven = svg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 8h18" />
    <path d="M7 5.5h.01M11 5.5h.01" />
    <rect x="6" y="11" width="12" height="7" rx="1" />
  </>,
);

const Pan = svg(
  <>
    <path d="M2 9h15l-1.2 7.4A3 3 0 0 1 12.8 19H6.2a3 3 0 0 1-3-2.6z" />
    <path d="M17 11.5h5" />
  </>,
);

const Griddle = svg(
  <>
    <path d="M3 13h18v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M8 4v5M12 3v6M16 4v5" />
  </>,
);

const PressureCooker = svg(
  <>
    <path d="M12 10V6M9.5 6h5" />
    <path d="M5 10h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <path d="M2 13h3M19 13h3" />
  </>,
);

export const EQUIPMENT_ICONS: Record<Equipment, LucideIcon> = {
  horno: Oven,
  sarten: Pan,
  cazuela: CookingPot,
  olla_presion: PressureCooker,
  plancha: Griddle,
  freidora_aire: Wind,
  microondas: Microwave,
  sin_coccion: Salad,
};

/** A Thermomix: the jug on its base. Used for Cookidoo, the Thermomix recipe platform. */
export const ThermomixIcon = svg(
  <>
    <path d="M8 3h8l1 11H7z" />
    <path d="M17 6h2.5v6H17" />
    <rect x="4" y="16" width="16" height="5" rx="1.5" />
    <path d="M12 18.5h.01" />
  </>,
);
