import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Previous / next week arrows around the week's date range. */
export function WeekNav({
  basePath,
  prevWeek,
  nextWeek,
  isCurrentWeek,
  rangeLabel,
}: {
  basePath: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
  rangeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href={`${basePath}?semana=${prevWeek}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
        aria-label="Semana anterior"
      >
        <ChevronLeft />
      </Link>
      <div className="flex flex-col items-center">
        <span className="font-medium">{rangeLabel}</span>
        {!isCurrentWeek && (
          <Link href={basePath} className="text-sm text-muted-foreground underline underline-offset-4">
            Ir a esta semana
          </Link>
        )}
      </div>
      <Link
        href={`${basePath}?semana=${nextWeek}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
        aria-label="Semana siguiente"
      >
        <ChevronRight />
      </Link>
    </div>
  );
}
