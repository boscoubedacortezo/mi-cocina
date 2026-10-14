import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a Cookidoo import link stays valid. */
export const SHARE_TTL_SECONDS = 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(payload: string) {
  // Signed with the service-role key: it is server-only and already a secret.
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`share:v1:${payload}`)
    .digest("base64url");
}

/** Token format: `<recipeId>.<expiresAtUnixSeconds>.<signature>`. */
export function createShareToken(recipeId: string, nowMs = Date.now()) {
  const expires = Math.floor(nowMs / 1000) + SHARE_TTL_SECONDS;
  const payload = `${recipeId}.${expires}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expires * 1000) };
}

/** Returns the recipe id when the token is authentic and not expired. */
export function verifyShareToken(token: string, nowMs = Date.now()) {
  const [recipeId, expires, signature, ...rest] = token.split(".");
  if (rest.length || !recipeId || !expires || !signature || !UUID.test(recipeId)) {
    return null;
  }
  const expected = Buffer.from(sign(`${recipeId}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < nowMs) return null;
  return recipeId;
}
