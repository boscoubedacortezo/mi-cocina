import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Only for the public share page, which
 * has no session and is gated by a signed token. Never use it for anything
 * the user can reach without that token.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
