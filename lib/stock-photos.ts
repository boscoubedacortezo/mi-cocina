import "server-only";

export type StockPhoto = {
  id: number;
  thumb: string;
  /** Image saved with the recipe (about 940 px wide). */
  large: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
};

export const PEXELS_HOME = "https://www.pexels.com";
const PEXELS_API = "https://api.pexels.com/v1/search";
const IMAGE_HOST = "images.pexels.com";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export const stockPhotosEnabled = () => Boolean(process.env.PEXELS_API_KEY);

type PexelsPhoto = {
  id: number;
  url: string;
  alt?: string;
  photographer: string;
  photographer_url: string;
  src: { medium: string; large: string };
};

async function search(query: string, perPage: number): Promise<StockPhoto[]> {
  const url = new URL(PEXELS_API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("locale", "es-ES");

  const response = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY! },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("La clave de Pexels no es válida.");
  if (response.status === 429) throw new Error("Pexels está limitando las búsquedas. Prueba más tarde.");
  if (!response.ok) throw new Error("Pexels no responde ahora mismo.");

  const data = (await response.json()) as { photos?: PexelsPhoto[] };
  return (data.photos ?? []).map((photo) => ({
    id: photo.id,
    thumb: photo.src.medium,
    large: photo.src.large,
    alt: photo.alt ?? "",
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pageUrl: photo.url,
  }));
}

/** Searches by the recipe title and, if that finds little, by its first tag. */
export async function searchStockPhotos(title: string, firstTag: string | undefined) {
  const found = await search(title, 12);
  if (found.length >= 6 || !firstTag) return found;
  const extra = await search(firstTag, 12);
  const seen = new Set(found.map((photo) => photo.id));
  return [...found, ...extra.filter((photo) => !seen.has(photo.id))].slice(0, 12);
}

/** Downloads a photo, only from Pexels' own image host. */
export async function downloadStockPhoto(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Foto no válida.");
  }
  if (url.protocol !== "https:" || url.hostname !== IMAGE_HOST || url.port) {
    throw new Error("Foto no válida.");
  }

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("No se pudo descargar la foto.");
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) throw new Error("Foto no válida.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error("La foto es demasiado grande.");

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("La foto es demasiado grande.");
  return { bytes, contentType, ext: contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg" };
}
