import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menú semanal" };

export default function Page() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">Menú semanal</h1>
      <p className="text-muted-foreground">Aquí planificarás comidas y cenas (fase 5).</p>
    </div>
  );
}
