import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Magic link uit de e-mail: ?token_hash=...&type=email (aanbevolen template) of ?code=... (PKCE).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/vandaag";
  const supabase = await createClient();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  if (!ok) return NextResponse.redirect(new URL("/login?fout=link-ongeldig", url));

  const { data } = await supabase.auth.getClaims();
  if (!isAllowedEmail(data?.claims?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?fout=geen-toegang", url));
  }
  return NextResponse.redirect(new URL(target, url));
}
