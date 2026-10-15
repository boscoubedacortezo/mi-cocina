/** cookidoo.es, cookidoo.co.uk, cookidoo.com.au, cookidoo.international, cookidoo.thermomix.com... */
const COOKIDOO_HOST = /^(www\.)?cookidoo\.[a-z]{2,}(\.[a-z]{2,})?$|^cookidoo\.thermomix\.com$/;

export function isCookidooUrl(raw: string | null | undefined) {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && COOKIDOO_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** Same recipe, same key: drops the query string and fragment (share trackers, etc.). */
export function normalizeRecipeUrl(raw: string) {
  const url = new URL(raw);
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Cookidoo serves its photos from tmecosys.com (and sometimes from cookidoo itself). */
export function isCookidooImageHost(hostname: string) {
  return (
    hostname === "tmecosys.com" ||
    hostname.endsWith(".tmecosys.com") ||
    COOKIDOO_HOST.test(hostname)
  );
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;

/** Every link inside a text, without the punctuation that follows it in a sentence. */
export function extractUrls(text: string) {
  return (text.match(URL_IN_TEXT) ?? []).map((url) => url.replace(/[.,;:!?)\]}»”’]+$/, ""));
}

/**
 * The link to use out of what was pasted. Sharing from Cookidoo gives a sentence
 * with the link in it ("Mira esta receta… https://cookidoo.es/…"): take the
 * Cookidoo link if there is one, else the first link, else the text as it came.
 */
export function extractCookidooUrl(text: string) {
  const urls = extractUrls(text);
  return urls.find(isCookidooUrl) ?? urls[0] ?? text.trim();
}
