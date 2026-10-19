import { Camera, FileText, Globe, Music2, Pencil, Sparkles, type LucideIcon } from "lucide-react";
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

/** A play button in its rounded screen. */
const YoutubeIcon = ((props: React.SVGProps<SVGSVGElement>) => (
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
    <rect x="2.5" y="5" width="19" height="14" rx="4" />
    <path d="m10 9.5 5 2.5-5 2.5z" />
  </svg>
)) as LucideIcon;

const ICONS: Record<Origin, LucideIcon> = {
  cookidoo: ThermomixIcon,
  instagram: InstagramIcon,
  tiktok: Music2,
  youtube: YoutubeIcon,
  web: Globe,
  texto: FileText,
  foto: Camera,
  manual: Pencil,
  ia: Sparkles,
};

/** The platforms with a look of their own; the rest share the plain pill. */
const BRAND_STYLES: Partial<Record<Origin, string>> = {
  cookidoo: "bg-[#00ac46] text-white",
  instagram:
    "bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] text-white",
  // TikTok's black with its cyan and red echo, on the icon.
  tiktok:
    "bg-black text-white [&_svg]:[filter:drop-shadow(-1px_0_0_#25f4ee)_drop-shadow(1px_1px_0_#fe2c55)]",
  youtube: "bg-[#ff0000] text-white",
  ia: "bg-[linear-gradient(135deg,#7c3aed_0%,#c026d3_100%)] text-white",
};

/** Where a recipe comes from, to sit on its photo, in the colours of its platform. */
export function OriginPill({ origin, className }: { origin: Origin; className?: string }) {
  const Icon = ICONS[origin];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shadow-sm",
        BRAND_STYLES[origin] ?? "bg-background/90 text-foreground",
        className,
      )}
      title={origin === "cookidoo" ? "Receta de Cookidoo: los pasos están allí" : `Origen: ${ORIGIN_LABELS[origin]}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {ORIGIN_LABELS[origin]}
    </span>
  );
}
