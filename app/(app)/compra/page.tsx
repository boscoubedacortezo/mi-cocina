import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lista de la compra" };

export default function Page() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">Lista de la compra</h1>
      <p className="text-muted-foreground">Aquí aparecerá la lista generada desde el menú (fase 6).</p>
    </div>
  );
}
