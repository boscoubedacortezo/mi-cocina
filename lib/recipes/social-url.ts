import { normalizeRecipeUrl } from "./cookidoo-url";

export type SocialPlatform = "instagram" | "tiktok" | "youtube";

/** Instagram, TikTok and YouTube posts, including their short share links (vm. / vt. / youtu.be). */
export function socialPlatform(raw: string | null | undefined): SocialPlatform | null {
  if (!raw) return null;
  try {
    const { protocol, hostname } = new URL(raw);
    if (protocol !== "https:" && protocol !== "http:") return null;
    const host = hostname.replace(/^www\./, "");
    if (host === "instagram.com") return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
  } catch {
    // Not a URL.
  }
  return null;
}

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/**
 * The same post gets the same link: share trackers go. YouTube keeps its video id, which
 * lives in the query string of watch links and in the path of youtu.be links.
 */
export function normalizeSocialUrl(raw: string) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  if (socialPlatform(raw) === "youtube" && url.pathname === "/watch" && url.searchParams.get("v")) {
    return `https://www.youtube.com/watch?v=${url.searchParams.get("v")}`;
  }
  return normalizeRecipeUrl(raw);
}
