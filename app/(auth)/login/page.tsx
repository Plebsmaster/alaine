import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

const ERRORS: Record<string, string> = {
  "geen-toegang": "Dit account heeft geen toegang tot deze app.",
  "link-ongeldig": "De inloglink is ongeldig of verlopen. Vraag een nieuwe code aan.",
};

const PRINCIPLES = [
  "FSRS plant je herhalingen; jij plant niets.",
  "Thema's worden door elkaar gehaald, zoals op de toets.",
  "AI maakt alleen concepten; jij keurt goed.",
];

// Inloggen (docs/design/README.md, 1d): op laptop links de leermethode, rechts het formulier.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { fout } = await searchParams;
  const error = typeof fout === "string" ? ERRORS[fout] : undefined;
  return (
    <main className="min-h-dvh md:grid md:grid-cols-[minmax(0,560px)_1fr]">
      <aside className="hidden flex-col bg-accent-deep px-14 py-12 text-on-deep md:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-on-deep text-xs font-bold text-accent-deep">PA</span>
          <span className="text-base font-bold">PA Studie</span>
        </div>
        <div className="mt-auto flex flex-col gap-7">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-on-deep-muted">Master Physician Assistant · HU</p>
          <p className="font-serif text-5xl font-medium leading-[1.08]">Eerst ophalen, dan pas zien.</p>
          <ol className="flex flex-col gap-3.5 text-base leading-[1.45] text-on-deep-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p} className="flex gap-3.5">
                <span className="font-bold tabular-nums text-on-deep-accent">0{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      </aside>
      <div className="md:flex md:min-h-dvh md:items-center md:justify-center md:px-6 md:py-10">
        <LoginForm notice={error ? <Notice tone="error">{error}</Notice> : null} />
      </div>
    </main>
  );
}
