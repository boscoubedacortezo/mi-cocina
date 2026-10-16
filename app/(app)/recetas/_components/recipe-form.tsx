"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Camera,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareImage } from "@/lib/images";
import {
  COURSE_LABELS,
  COURSES,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MAIN_INGREDIENT_LABELS,
  MAIN_INGREDIENTS,
  RECIPE_IMAGES_BUCKET,
  SHOP_SECTIONS,
  UNITS,
  type Course,
  type Equipment,
  type MainIngredient,
  type ShopSection,
  type SourceType,
  type Unit,
} from "@/lib/recipes/constants";
import type { RecipeDraft } from "@/lib/recipes/draft";
import { recipeInputSchema } from "@/lib/recipes/schema";
import { createClient } from "@/lib/supabase/client";
import { moveItem, selectClass } from "@/lib/utils";
import { createRecipe, updateRecipe } from "../actions";

export type RecipeFormInitial = RecipeDraft & {
  image_path: string | null;
  image_url: string | null;
};

type IngredientRow = {
  key: string;
  name: string;
  quantity: string;
  unit: Unit | "";
  shop_section: ShopSection;
  optional: boolean;
};
type StepRow = { key: string; text: string };

const newKey = () => crypto.randomUUID();

const emptyIngredient = (): IngredientRow => ({
  key: newKey(),
  name: "",
  quantity: "",
  unit: "",
  shop_section: "Otros",
  optional: false,
});

function toNumber(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function RecipeForm({
  userId,
  recipeId,
  sourceType = "manual",
  initial,
  importedImageUrl = null,
  cancelHref,
}: {
  userId: string;
  /** Set when editing an existing recipe; omitted when creating one. */
  recipeId?: string;
  sourceType?: SourceType;
  initial?: RecipeFormInitial;
  /** A photo that came with an import (Cookidoo's): shown now, saved with the recipe. */
  importedImageUrl?: string | null;
  /** Where "Cancelar" goes back to. */
  cancelHref: string;
}) {
  const router = useRouter();
  const formId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  // Empty means "automatic": the AI fills them in when the recipe is saved.
  const [course, setCourse] = useState<Course | "">(initial?.course ?? "");
  const [mainIngredient, setMainIngredient] = useState<MainIngredient | "">(
    initial?.main_ingredient ?? "",
  );
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial?.ingredients.length
      ? initial.ingredients.map((item) => ({
          key: newKey(),
          name: item.name,
          quantity: item.quantity === null ? "" : String(item.quantity),
          unit: item.unit ?? "",
          shop_section: item.shop_section,
          optional: item.optional,
        }))
      : [emptyIngredient()],
  );
  const [steps, setSteps] = useState<StepRow[]>(
    initial?.steps.length
      ? initial.steps.map((step) => ({ key: newKey(), text: step.text }))
      : [{ key: newKey(), text: "" }],
  );

  // Photo: the stored path is kept until a new one is uploaded on save.
  const [imagePath, setImagePath] = useState(initial?.image_path ?? null);
  const [preview, setPreview] = useState(initial?.image_url ?? importedImageUrl);
  // The imported photo stays remote until the recipe is saved; any choice of the user replaces it.
  const [remoteImage, setRemoteImage] = useState(importedImageUrl);
  const [newImage, setNewImage] = useState<{ blob: Blob; ext: string } | null>(
    null,
  );

  // Compared with the values the form started with to know if leaving loses work.
  const snapshot = JSON.stringify([
    title,
    description,
    servings,
    course,
    mainIngredient,
    equipment,
    tags,
    sourceUrl,
    notes,
    ingredients.map((row) => [row.name, row.quantity, row.unit, row.shop_section, row.optional]),
    steps.map((step) => step.text),
  ]);
  const [startSnapshot] = useState(snapshot);
  const dirty =
    snapshot !== startSnapshot || newImage !== null || imagePath !== (initial?.image_path ?? null);

  function cancel() {
    // An imported draft costs an AI call: ask even if nothing was edited.
    const discardsImport = !recipeId && Boolean(initial);
    if (dirty || discardsImport) {
      const message = dirty
        ? "Hay cambios sin guardar. ¿Descartarlos?"
        : "Se descartará la receta importada. ¿Seguir?";
      if (!window.confirm(message)) return;
    }
    router.push(cancelHref);
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 20) setTags([...tags, tag]);
    setTagDraft("");
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepareImage(file);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setNewImage(prepared);
      setRemoteImage(null);
      setPreview(URL.createObjectURL(prepared.blob));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Imagen no válida.");
    }
  }

  function removeImage() {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setNewImage(null);
    setRemoteImage(null);
    setPreview(null);
    setImagePath(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const quantities = ingredients.map((row) => toNumber(row.quantity));
    if (quantities.some((q) => Number.isNaN(q))) {
      toast.error("Hay una cantidad que no es un número.");
      return;
    }

    // Empty rows are dropped; the rest is validated with the shared schema.
    const parsed = recipeInputSchema.safeParse({
      title,
      description,
      servings: toNumber(servings),
      // Times are not edited here: the AI sets them when the recipe is saved.
      // Existing values travel along so saving never erases them.
      prep_minutes: initial?.prep_minutes ?? null,
      cook_minutes: initial?.cook_minutes ?? null,
      tags,
      course: course || null,
      main_ingredient: mainIngredient || null,
      equipment,
      source_type: sourceType,
      source_url: sourceUrl,
      notes,
      image_path: imagePath,
      ingredients: ingredients
        .map((row, i) => ({ row, quantity: quantities[i] }))
        .filter(({ row }) => row.name.trim() || row.quantity.trim())
        .map(({ row, quantity }) => ({
          name: row.name,
          quantity,
          unit: row.unit || null,
          shop_section: row.shop_section,
          optional: row.optional,
        })),
      steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text })),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    startTransition(async () => {
      let uploadedPath: string | null = null;
      const payload: typeof parsed.data & { image_source_url?: string } = { ...parsed.data };
      if (!recipeId && remoteImage && !newImage && !imagePath) payload.image_source_url = remoteImage;

      if (newImage) {
        const path = `${userId}/${crypto.randomUUID()}.${newImage.ext}`;
        const { error } = await createClient()
          .storage.from(RECIPE_IMAGES_BUCKET)
          .upload(path, newImage.blob, {
            contentType: newImage.blob.type || undefined,
          });
        if (error) {
          toast.error("No se pudo subir la foto. Inténtalo de nuevo.");
          return;
        }
        uploadedPath = path;
        payload.image_path = path;
      }

      // On success the action redirects, so it only returns when it failed.
      const result = recipeId
        ? await updateRecipe(recipeId, payload)
        : await createRecipe(payload);
      if (result?.error) {
        toast.error(result.error);
        if (uploadedPath) {
          await createClient()
            .storage.from(RECIPE_IMAGES_BUCKET)
            .remove([uploadedPath]);
        }
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 pb-4" noValidate>
      {recipeId && (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Volver a la receta
        </button>
      )}
      <section className="flex flex-col gap-3">
        <Label>Foto</Label>
        {preview ? (
          <div className="relative overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-[4/3] w-full object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={removeImage}
              aria-label="Quitar foto"
            >
              <X />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"
          >
            <Camera className="size-6" aria-hidden />
            Añadir foto
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => onPickImage(e.target.files?.[0])}
        />
        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            Cambiar foto
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-title`}>Título</Label>
          <Input
            id={`${formId}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-description`}>Descripción</Label>
          <Textarea
            id={`${formId}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-servings`}>Raciones</Label>
          <Input
            id={`${formId}-servings`}
            inputMode="numeric"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-28"
          />
          <p className="text-sm text-muted-foreground">
            Para cuántas raciones están escritas las cantidades. Para ver otras cantidades, usa
            el selector de raciones de la receta. Los tiempos los calcula la IA al guardar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-course`}>Tipo de plato</Label>
            <select
              id={`${formId}-course`}
              value={course}
              onChange={(e) => setCourse(e.target.value as Course | "")}
              className={selectClass}
            >
              <option value="">Automático (IA)</option>
              {COURSES.map((value) => (
                <option key={value} value={value}>
                  {COURSE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-main`}>Ingrediente principal</Label>
            <select
              id={`${formId}-main`}
              value={mainIngredient}
              onChange={(e) => setMainIngredient(e.target.value as MainIngredient | "")}
              className={selectClass}
            >
              <option value="">Automático (IA)</option>
              {MAIN_INGREDIENTS.map((value) => (
                <option key={value} value={value}>
                  {MAIN_INGREDIENT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Cómo se cocina</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {EQUIPMENT.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={equipment.includes(value)}
                  onChange={(e) =>
                    setEquipment(
                      e.target.checked
                        ? [...equipment, value]
                        : equipment.filter((item) => item !== value),
                    )
                  }
                />
                {EQUIPMENT_LABELS[value]}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Si no marcas ninguno, la IA lo deduce de los pasos al guardar. La Thermomix se marca sola
            cuando la receta tiene versión Thermomix o viene de Cookidoo.
          </p>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-tags`}>Etiquetas</Label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    aria-label={`Quitar etiqueta ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              id={`${formId}-tags`}
              value={tagDraft}
              placeholder="p. ej. vegetariano, horno"
              onChange={(e) => {
                const value = e.target.value;
                if (value.endsWith(",")) addTag(value.slice(0, -1));
                else setTagDraft(value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagDraft);
                }
              }}
              onBlur={() => addTag(tagDraft)}
            />
            <Button type="button" variant="outline" onClick={() => addTag(tagDraft)}>
              Añadir
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Lo que dejes en automático lo rellena la IA al guardar. Lo que pongas tú no se cambia.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Ingredientes</h2>
        <ul className="flex flex-col gap-3">
          {ingredients.map((row, index) => {
            const update = (patch: Partial<IngredientRow>) =>
              setIngredients(
                ingredients.map((r) => (r.key === row.key ? { ...r, ...patch } : r)),
              );
            return (
              <li key={row.key} className="flex flex-col gap-2 rounded-xl border p-3">
                <Input
                  value={row.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Ingrediente"
                  aria-label={`Ingrediente ${index + 1}`}
                  maxLength={120}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={row.quantity}
                    onChange={(e) => update({ quantity: e.target.value })}
                    inputMode="decimal"
                    placeholder="Cantidad"
                    aria-label="Cantidad"
                  />
                  <select
                    value={row.unit}
                    onChange={(e) => update({ unit: e.target.value as Unit | "" })}
                    className={selectClass}
                    aria-label="Unidad"
                  >
                    <option value="">Sin unidad</option>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={row.shop_section}
                  onChange={(e) =>
                    update({ shop_section: e.target.value as ShopSection })
                  }
                  className={selectClass}
                  aria-label="Sección del súper"
                >
                  {SHOP_SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.optional}
                      onChange={(e) => update({ optional: e.target.checked })}
                      className="size-4"
                    />
                    Opcional
                  </label>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => setIngredients(moveItem(ingredients, index, index - 1))}
                      aria-label="Subir ingrediente"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === ingredients.length - 1}
                      onClick={() => setIngredients(moveItem(ingredients, index, index + 1))}
                      aria-label="Bajar ingrediente"
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setIngredients(ingredients.filter((r) => r.key !== row.key))
                      }
                      aria-label="Quitar ingrediente"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIngredients([...ingredients, emptyIngredient()])}
        >
          <Plus /> Añadir ingrediente
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Pasos</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.key} className="flex flex-col gap-2 rounded-xl border p-3">
              <Label htmlFor={`${formId}-step-${step.key}`}>Paso {index + 1}</Label>
              <Textarea
                id={`${formId}-step-${step.key}`}
                value={step.text}
                onChange={(e) =>
                  setSteps(
                    steps.map((s) =>
                      s.key === step.key ? { ...s, text: e.target.value } : s,
                    ),
                  )
                }
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => setSteps(moveItem(steps, index, index - 1))}
                  aria-label="Subir paso"
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === steps.length - 1}
                  onClick={() => setSteps(moveItem(steps, index, index + 1))}
                  aria-label="Bajar paso"
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSteps(steps.filter((s) => s.key !== step.key))}
                  aria-label="Quitar paso"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSteps([...steps, { key: newKey(), text: "" }])}
        >
          <Plus /> Añadir paso
        </Button>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-notes`}>Notas</Label>
          <Textarea
            id={`${formId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={4000}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-source`}>Origen (URL)</Label>
          <Input
            id={`${formId}-source`}
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={cancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : recipeId ? "Guardar cambios" : "Crear receta"}
        </Button>
      </div>
    </form>
  );
}
