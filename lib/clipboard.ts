import { toast } from "sonner";

/**
 * Copies like a manual select-and-copy: the clipboard gets both the plain text
 * and its HTML. Some editors (Cookidoo's step field) refuse a plain-text-only
 * paste, which is all `navigator.clipboard.writeText` provides.
 */
function copyAsSelection(text: string) {
  const span = document.createElement("span");
  span.textContent = text;
  // Rendered (selection needs it) but out of sight.
  Object.assign(span.style, {
    position: "fixed",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    userSelect: "text",
  });
  document.body.appendChild(span);

  const selection = window.getSelection();
  const previous = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  const range = document.createRange();
  range.selectNodeContents(span);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  selection?.removeAllRanges();
  if (previous) selection?.addRange(previous);
  span.remove();
  return ok;
}

async function copyRich(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([`<meta charset="utf-8"><span>${escaped}</span>`], {
        type: "text/html",
      }),
    }),
  ]);
}

/** Copies text and tells the user, or says how to do it by hand. */
export async function copyText(text: string, label: string) {
  // Must run before any await so it still counts as part of the click.
  if (copyAsSelection(text)) {
    toast.success(`${label} copiado`);
    return;
  }
  try {
    await copyRich(text);
  } catch {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
      return;
    }
  }
  toast.success(`${label} copiado`);
}
