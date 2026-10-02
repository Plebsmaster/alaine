import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { CaseSession, type PublicCase } from "./case-session";

export const metadata: Metadata = { title: "Casussessie" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CaseSessionPage({ searchParams }: PageProps<"/casussen/sessie">) {
  const { ids: raw } = await searchParams;
  const ids = (typeof raw === "string" ? raw.split(",") : []).filter((x) => UUID.test(x)).slice(0, 5);
  const { supabase } = await requireUser();

  // Alleen wat de student mag zien vóór het rangschikken: geen diagnose, geen uitwerking.
  const { data } = ids.length
    ? await supabase.from("cases").select("id, title, vignette, question, topics(name)").in("id", ids).eq("status", "active")
    : { data: [] };
  const cases: PublicCase[] = ids
    .map((id) => (data ?? []).find((c) => c.id === id))
    .filter((c) => !!c)
    .map((c) => ({ id: c.id, title: c.title, vignette: c.vignette, question: c.question, topic_name: c.topics?.name ?? "" }));

  if (cases.length === 0) {
    return (
      <>
        <PageHeader title="Casussessie" />
        <Panel className="text-sm text-muted">
          Geen casussen gevonden. <Link className="underline" href="/casussen">Start een nieuwe sessie</Link>.
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Casussessie" />
      <CaseSession cases={cases} sessionId={crypto.randomUUID()} aiEnabled={aiConfigured()} />
    </>
  );
}
