"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * The recipe search box. Enter searches (the surrounding form does that); emptying
 * the box, with the cross or by deleting, drops the search from the address too,
 * otherwise the list would stay filtered by text that is no longer there.
 */
export function SearchInput({
  defaultValue,
  clearHref,
}: {
  defaultValue?: string;
  /** The current address without the search text (other filters kept). */
  clearHref: string;
}) {
  const router = useRouter();

  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Buscar receta"
        aria-label="Buscar receta"
        className="pl-8"
        onChange={(event) => {
          if (event.target.value === "" && defaultValue) router.replace(clearHref);
        }}
      />
    </div>
  );
}
