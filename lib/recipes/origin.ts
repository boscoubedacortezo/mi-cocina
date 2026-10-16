import type { SourceType } from "./constants";
import { isCookidooUrl } from "./cookidoo-url";
import { socialPlatform } from "./social-url";

/** Where a recipe comes from, as the card shows it. */
export const ORIGINS = ["cookidoo", "instagram", "tiktok", "youtube", "web", "texto", "foto", "manual"] as const;
export type Origin = (typeof ORIGINS)[number];

export const ORIGIN_LABELS: Record<Origin, string> = {
  cookidoo: "Cookidoo",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  web: "Web",
  texto: "Texto",
  foto: "Foto",
  manual: "Manual",
};

/**
 * Cookidoo and the social networks are told by their link, whatever the way it was added;
 * the rest follow how it was created.
 */
export function recipeOrigin(sourceType: SourceType, sourceUrl: string | null): Origin {
  if (isCookidooUrl(sourceUrl)) return "cookidoo";
  const social = socialPlatform(sourceUrl);
  if (social) return social;
  if (sourceType === "url") return "web";
  return sourceType;
}
