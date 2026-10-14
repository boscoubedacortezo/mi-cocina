"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, ListChecks, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { formatMinutes } from "@/lib/recipes/format";
import {
  buildIngredientsBlock,
  buildStepsBlock,
  stepSettings,
} from "@/lib/thermomix/cookidoo";
import type { ThermomixStep } from "@/lib/thermomix/schema";
import { VersionEditor } from "./version-editor";

export type VersionData = {
  id: string;
  servings: number;
  notes: string | null;
  ingredients_text: string;
  steps: ThermomixStep[];
  cookidoo_text: string;
};

export function VersionView({
  recipeId,
  version,
  prepMinutes,
  totalMinutes,
}: {
  recipeId: string;
  version: VersionData;
  prepMinutes: number | null;
  totalMinutes: number | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <VersionEditor
        recipeId={recipeId}
        version={version}
        onDone={() => setEditing(false)}
      />
    );
  }

  const ingredients = buildIngredientsBlock(version.ingredients_text)
    .split("\n")
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/recetas/${recipeId}/thermomix/cookidoo`}
          className={buttonVariants({ size: "lg" })}
        >
          <ListChecks /> Pasar a Cookidoo paso a paso
        </Link>
        <Button
          type="button"
          variant="outline"
          onClick={() => copyText(version.cookidoo_text, "Texto para Cookidoo")}
        >
          <ClipboardCopy /> Copiar todo el texto
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(buildIngredientsBlock(version.ingredients_text), "Ingredientes")}
          >
            Ingredientes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(buildStepsBlock(version.steps), "Pasos")}
          >
            Pasos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Editar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          En la app de Cookidoo cada ingrediente y cada paso se escriben por separado: la guía paso a paso te deja copiarlos uno a uno.
        </p>
      </div>

      {version.notes && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <strong>Adaptación:</strong> {version.notes}
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Raciones", String(version.servings)],
          ["Preparación", formatMinutes(prepMinutes) ?? "—"],
          ["Tiempo total", formatMinutes(totalMinutes) ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Ingredientes</h2>
        <ul className="flex flex-col divide-y rounded-xl border">
          {ingredients.map((line, index) => (
            <li key={index} className="px-3 py-2">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Preparación</h2>
        <ol className="flex flex-col gap-4">
          {version.steps.map((step, index) => {
            const settings = stepSettings(step);
            return (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <p>{step.text}</p>
                  {settings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {settings.map((setting) => (
                        <Badge key={setting} variant="secondary">
                          {setting}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
