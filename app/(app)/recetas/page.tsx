import type { Metadata } from "next";

export const metadata: Metadata = { title: "Recetas" };

export default function Page() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">Recetas</h1>
      <p className="text-muted-foreground">Aquí verás tus recetas (fase 2).</p>
    </div>
  );
}
