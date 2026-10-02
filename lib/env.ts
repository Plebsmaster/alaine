// Omgevingsvariabelen op één plek. NEXT_PUBLIC_* mag naar de client; de rest niet.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Omgevingsvariabele ${name} ontbreekt. Zie README.md, stap 2.`);
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Alleen dit adres mag inloggen. Server-side. */
export function allowedEmail(): string {
  return required("ALLOWED_EMAIL", process.env.ALLOWED_EMAIL).trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === allowedEmail();
}
