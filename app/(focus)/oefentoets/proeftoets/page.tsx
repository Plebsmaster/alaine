import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ExamRunner, type ExamQuestion } from "./exam-runner";

export const metadata: Metadata = { title: "Proeftoets" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ExamRunPage({ searchParams }: PageProps<"/oefentoets/proeftoets">) {
  const { ids: raw } = await searchParams;
  const ids = (typeof raw === "string" ? raw.split(",") : []).filter((x) => UUID.test(x)).slice(0, 60);
  const { supabase } = await requireUser();
  // Geen juiste opties of modelantwoorden: die komen pas na inleveren.
  const { data } = ids.length
    ? await supabase.from("questions").select("id, format, stem, options, topics(name)").in("id", ids).eq("status", "active")
    : { data: [] };
  const questions: ExamQuestion[] = ids
    .map((id) => (data ?? []).find((q) => q.id === id))
    .filter((q) => !!q)
    .map((q) => ({
      id: q.id,
      format: q.format as "open" | "mcq",
      stem: q.stem,
      options: (q.options as string[] | null) ?? null,
      topic_name: q.topics?.name ?? "",
    }));

  return (
    <>
      <PageHeader title="Proeftoets" settings={false}>
        <span className="text-sm text-muted">{questions.length} vragen</span>
      </PageHeader>
      {questions.length === 0 ? (
        <Panel className="text-sm text-muted">Geen vragen gevonden. Start een nieuwe proeftoets.</Panel>
      ) : (
        <ExamRunner questions={questions} sessionId={crypto.randomUUID()} />
      )}
    </>
  );
}
