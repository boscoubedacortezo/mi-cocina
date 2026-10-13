import "server-only";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Verifies the session on the server; Server Actions must not trust the proxy alone. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !isAllowedEmail(claims.email as string | undefined)) {
    redirect("/login");
  }
  return { supabase, userId: claims.sub };
}
