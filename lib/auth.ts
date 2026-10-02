import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Haalt de ingelogde gebruiker op en controleert ALLOWED_EMAIL.
 * Gebruik in elke pagina en elke Server Action die data aanraakt.
 * getClaims verifieert de JWT (lokaal bij asymmetrische sleutels, anders via Supabase Auth).
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  if (!isAllowedEmail(claims.email)) {
    await supabase.auth.signOut();
    redirect("/login?fout=geen-toegang");
  }
  return { supabase, user: { id: claims.sub, email: String(claims.email) } };
});
