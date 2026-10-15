import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ImportError } from "./errors";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") ||
    lower.startsWith("ff")
  );
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("La URL debe empezar por http:// o https://.");
  }
  if (url.username || url.password) {
    throw new ImportError("La URL no puede llevar usuario ni contraseña.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImportError("Esa URL usa un puerto no permitido.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const blocked = new ImportError("Esa dirección no es accesible desde aquí.");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw blocked;
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw blocked;
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ImportError("No se encontró esa página. Revisa la URL.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw blocked;
  }
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ImportError("La página es demasiado grande para procesarla.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function decode(bytes: Uint8Array, contentType: string) {
  const label = contentType.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/**
 * Downloads an HTML page for a user-supplied URL. Every hop (including
 * redirects) is checked so it cannot reach private or internal networks.
 */
export async function fetchPublicHtml(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError("La URL no es válida.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MiCocinaBot/1.0; personal recipe importer)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "es-ES,es;q=0.9,en;q=0.5",
        },
      });
    } catch {
      throw new ImportError("No se pudo descargar la página. Inténtalo de nuevo.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ImportError("La página redirige a un destino no válido.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new ImportError(
        `La página respondió con un error (${response.status}). Prueba a pegar el texto de la receta.`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(contentType)) {
      throw new ImportError("Esa URL no es una página web.");
    }
    return { html: decode(await readLimited(response), contentType), finalUrl: url.toString() };
  }
  throw new ImportError("La página tiene demasiadas redirecciones.");
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Downloads an image from a public URL with the same protections as pages
 * (every redirect hop is checked against private networks), and only from
 * hosts the caller explicitly allows.
 */
export async function fetchPublicImage(rawUrl: string, allowHost: (hostname: string) => boolean) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError("La imagen no es válida.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" || !allowHost(url.hostname)) {
      throw new ImportError("La imagen no es de un servidor permitido.");
    }
    await assertPublicUrl(url);

    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new ImportError("No se pudo descargar la imagen.");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ImportError("No se pudo descargar la imagen.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new ImportError("No se pudo descargar la imagen.");

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
      throw new ImportError("La imagen no tiene un formato admitido.");
    }
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
      throw new ImportError("La imagen es demasiado grande.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new ImportError("La imagen es demasiado grande.");
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    return { bytes, contentType, ext };
  }
  throw new ImportError("La imagen tiene demasiadas redirecciones.");
}
