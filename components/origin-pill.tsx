import { Camera, FileText, Globe, Music2, Pencil, type LucideIcon } from "lucide-react";
import { ThermomixIcon } from "@/components/equipment-icons";
import { ORIGIN_LABELS, type Origin } from "@/lib/recipes/origin";
import { cn } from "@/lib/utils";

/** Lucide has no brand icons: the usual outline, drawn with its grid and stroke. */
const InstagramIcon = ((props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.5 6.5h.01" />
  </svg>
)) as LucideIcon;

const ICONS: Record<Origin, LucideIcon> = {
  cookidoo: ThermomixIcon,
  instagram: InstagramIcon,
  tiktok: Music2,
  web: Globe,
  texto: FileText,
  foto: Camera,
  manual: Pencil,
};

/** Where a recipe comes from, to sit on its photo. Cookidoo keeps its own green. */
export function OriginPill({ origin, className }: { origin: Origin; className?: string }) {
  const Icon = ICONS[origin];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shadow-sm",
        origin === "cookidoo" ? "bg-[#00ac46] text-white" : "bg-background/90 text-foreground",
        className,
      )}
      title={origin === "cookidoo" ? "Receta de Cookidoo: los pasos están allí" : `Origen: ${ORIGIN_LABELS[origin]}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {ORIGIN_LABELS[origin]}
    </span>
  );
}
