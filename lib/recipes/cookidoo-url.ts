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
