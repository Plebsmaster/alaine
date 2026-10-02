import type { Metadata } from "next";
import { Notice, Panel } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

const ERRORS: Record<string, string> = {
  "geen-toegang": "Dit account heeft geen toegang tot deze app.",
  "link-ongeldig": "De inloglink is ongeldig of verlopen. Vraag een nieuwe code aan.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { fout } = await searchParams;
  const error = typeof fout === "string" ? ERRORS[fout] : undefined;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">PA Studie</h1>
      <p className="mb-6 text-sm text-muted">Log in met je e-mailadres. Je krijgt een code per mail.</p>
      {error ? (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      <Panel>
        <LoginForm />
      </Panel>
    </main>
  );
}
