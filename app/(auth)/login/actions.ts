"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; error?: string; info?: string };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { step: "email", email, error: "Vul je e-mailadres in." };
  // Controle aan de serverkant: alleen ALLOWED_EMAIL krijgt een code.
  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "Dit e-mailadres heeft geen toegang tot deze app." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await origin()}/auth/confirm?next=/vandaag` },
  });
  if (error) {
    const tooSoon = error.status === 429 || /only request this after|rate limit/i.test(error.message);
    return {
      step: "email",
      email,
      error: tooSoon
        ? "Je hebt net al een code aangevraagd. Wacht een minuut en probeer het opnieuw."
        : `Versturen mislukt: ${error.message}`,
    };
  }
  return { step: "code", email, info: `We hebben een code gestuurd naar ${email}.` };
}

/** Eén actie voor beide stappen: met `token` in het formulier wordt de code gecontroleerd. */
export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  return formData.has("token") ? verifyCode(prev, formData) : sendCode(prev, formData);
}

async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "Dit e-mailadres heeft geen toegang tot deze app." };
  }
  if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "Vul de code uit de e-mail in." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "Deze code klopt niet of is verlopen. Vraag een nieuwe aan." };
  redirect("/vandaag");
}
