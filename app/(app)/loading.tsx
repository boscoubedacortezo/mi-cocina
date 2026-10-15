// Shown instantly while a tab loads, so a tap on Recetas / Menú / Compra responds at once.
function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <Block className="h-8 w-40" />
      <Block className="h-10 w-full" />
      <Block className="h-28 w-full" />
      <Block className="h-28 w-full" />
      <Block className="h-28 w-full" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
