# Mi Cocina — Especificación del proyecto

Web app personal (un único usuario) para:
1. Almacenar recetas.
2. Convertir recetas a formato Thermomix TM7 listo para pegar en Cookidoo ("Creadas por mí").
3. Elaborar un menú semanal (comidas y cenas) y generar la lista de la compra.

Idioma de la interfaz y del contenido: español.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- PWA instalable en móvil (diseño mobile-first)
- Supabase: Postgres, Auth (magic link por email, un solo usuario permitido), Storage (fotos)
- Row Level Security activada en todas las tablas (`user_id = auth.uid()`)
- IA: Anthropic API (SDK `@anthropic-ai/sdk`), llamadas solo desde el servidor (Route Handlers / Server Actions). Nunca exponer la API key al cliente.
- Despliegue: Vercel conectado al repo de GitHub
- Migraciones SQL versionadas en `supabase/migrations`

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ALLOWED_EMAIL=
```

## Modelo de datos

- **recipes**: id, user_id, title, description, servings (default 4), prep_minutes, cook_minutes, tags text[], source_type ('manual' | 'texto' | 'url' | 'foto'), source_url, image_path, notes, created_at, updated_at
- **recipe_ingredients**: id, recipe_id, position, name, quantity numeric, unit ('g' | 'kg' | 'ml' | 'l' | 'ud' | 'cda' | 'cdta' | 'pizca' | 'al gusto'), shop_section, optional bool
- **recipe_steps**: id, recipe_id, position, text
- **thermomix_versions**: id, recipe_id, model ('TM7'), ingredients_text, steps jsonb `[{text, time_seconds, temperature ('Varoma' | número | null), speed ('cuchara' | '1'..'10' | 'turbo'), reverse bool, accessory ('mariposa' | 'cestillo' | 'varoma' | null)}]`, cookidoo_text, created_at
- **menus**: id, user_id, week_start date (lunes), created_at
- **menu_items**: id, menu_id, date, meal ('comida' | 'cena'), recipe_id, servings (default 4)
- **shopping_items**: id, menu_id, name, quantity, unit, shop_section, checked bool, is_manual bool

Secciones del súper: Frutas y verduras, Carne, Pescado, Lácteos y huevos, Panadería, Despensa, Congelados, Bebidas, Otros.

## Funcionalidades

### 1. Recetario
- Listado con búsqueda y filtro por etiquetas; ficha de receta con foto.
- Alta de receta por 4 vías:
  - Manual (formulario de ingredientes y pasos).
  - Texto libre pegado → IA lo estructura.
  - URL → el servidor descarga la página (intentar primero JSON-LD `Recipe`; si no hay, IA sobre el HTML limpio).
  - Foto (libro/papel) → IA con visión lo extrae.
- Toda importación por IA termina en el formulario de revisión editable antes de guardar.
- La IA devuelve JSON validado con zod; normaliza unidades a las del modelo.

### 2. Conversión Thermomix TM7
- Botón "Convertir a TM7" en la ficha.
- La IA adapta ingredientes y pasos a la TM7: tiempo, temperatura, velocidad, giro inverso y accesorios por paso; respeta capacidades del vaso y adapta raciones.
- Se guarda como `thermomix_versions` y se puede editar.
- Botón "Copiar para Cookidoo": genera `cookidoo_text` con ingredientes (uno por línea) y pasos numerados en formato "Texto del paso — 5 min / 100 °C / vel 1 / giro inverso".

### 3. Menú semanal
- Vista semana (lunes–domingo) × (comida, cena). Raciones por defecto: 4.
- Modo manual: asignar receta a cada hueco.
- Modo IA: propone menú variado y equilibrado usando solo recetas guardadas, evitando repetir en la misma semana; el usuario puede fijar huecos antes de generar y regenerar huecos sueltos.

### 4. Lista de la compra
- Generada a partir del menú: escala cantidades por raciones, suma ingredientes iguales (normalizando nombre y unidad) y agrupa por sección.
- Marcar como comprado, añadir artículos manuales, regenerar sin perder los manuales.
- Botón "Copiar lista" en texto plano.

## Fases de desarrollo

1. Setup: proyecto Next.js, Supabase (cliente, auth con magic link restringido a `ALLOWED_EMAIL`), migraciones, layout móvil, despliegue en Vercel.
2. Recetario manual (CRUD completo + fotos).
3. Importación con IA (texto, URL, foto).
4. Conversión TM7 + copiar para Cookidoo.
5. Menú semanal (manual + IA).
6. Lista de la compra.
7. PWA (manifest, iconos, instalable).

Trabajar fase por fase; al terminar cada una, probar, hacer commit y esperar confirmación antes de seguir.

## Convenciones

- Código y nombres en inglés; textos de UI en español.
- Validación con zod en cliente y servidor.
- Prompts de IA en `lib/ai/prompts/`, uno por tarea.
- Modelo de IA configurable en una constante (`lib/ai/config.ts`).
