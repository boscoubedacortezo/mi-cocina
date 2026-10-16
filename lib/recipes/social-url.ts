export type SocialPlatform = "instagram" | "tiktok";

/** Instagram and TikTok posts, including TikTok's short share links (vm. / vt.). */
export function socialPlatform(raw: string | null | undefined): SocialPlatform | null {
  if (!raw) return null;
  try {
    const { protocol, hostname } = new URL(raw);
    if (protocol !== "https:" && protocol !== "http:") return null;
    const host = hostname.replace(/^www\./, "");
    if (host === "instagram.com") return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  } catch {
    // Not a URL.
  }
  return null;
}

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};
