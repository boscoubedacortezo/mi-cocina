import "server-only";
import { headers } from "next/headers";

/** Public origin of the current request, e.g. https://mi-cocina-three.vercel.app */
export async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
