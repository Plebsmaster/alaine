import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/nav";
import { Button, LinkButton, Notice, PageHeader, Select } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { EXAM_DEFAULT } from "@/lib/exam";
import { startExam } from "./actions";
import { AiQuestionsForm } from "./ai-questions-form";

export const metadata: Metadata = { title: "Oefentoets" };

const ERRORS: Record<string, string> = {
  thema: "Kies minstens één thema voor de proeftoets.",
  "geen-vragen": "Er zijn geen goedgekeurde toetsvragen voor deze thema's.",
};

export default async function ExamPage({ searchParams }: PageProps<"/oefentoets">) {
  const { fout } = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: topics }, { data: questions }, { data: attempts }] = await Promise.all([
    supabase.from("topics").select("id, name, sort_order, modules(name, sort_order)").order("sort_order"),
    supabase.from("questions").select("id, topic_id, kind, status"),
    supabase.from("question_attempts").select("question_id").limit(10000),
  ]);
  const tried = new Set((attempts ?? []).map((a) => a.question_id));
  const sorted = (topics ?? []).sort(
    (a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order,
  );
  const count = (topicId: string, kind: string) =>
    (questions ?? []).filter((q) => q.topic_id === topicId && q.kind === kind && q.status === "active");
  const drafts = (questions ?? []).filter((q) => q.status === "draft").length;
  const error = typeof fout === "string" ? ERRORS[fout] : undefined;

  const pretestTopics = sorted
    .map((t) => {
      const qs = count(t.id, "pretest");
      return { id: t.id, name: t.name, n: qs.length, done: qs.filter((q) => tried.has(q.id)).length };
    })
    .filter((t) => t.n > 0);

  return (
    <>
      <PageHeader title="Oefentoets">
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/oefentoets/vragen">Alle vragen</LinkButton>
          <LinkButton href="/oefentoets/vraag/nieuw">Nieuwe vraag</LinkButton>
        </div>
      </PageHeader>
      <div className="space-y-5">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {drafts > 0 ? (
          <Notice>
            {drafts} conceptvra(a)g(en) wachten op{" "}
            <Link className="font-bold text-accent" href="/goedkeuren?soort=vragen">
              Goedkeuren
            </Link>
            .
          </Notice>
        ) : null}

        {/* Ontwerp 1s/1t: pretest en proeftoets naast elkaar. */}
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section aria-labelledby="pretest" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-5 md:px-6 md:py-[22px]">
            <h2 id="pretest" className="font-serif text-2xl font-medium">
              Pretest
            </h2>
            <p className="text-sm leading-normal text-text-2">
              Doe de pretest vóórdat je aan een thema begint. Je ziet na elke vraag het modelantwoord; er is geen score. Proberen helpt je de stof daarna beter te onthouden.
            </p>
            {pretestTopics.length === 0 ? (
              <p className="text-sm text-muted">Nog geen goedgekeurde pretestvragen.</p>
            ) : (
              <ul className="border-t border-border-subtle">
                {pretestTopics.map((t) => (
                  <li key={t.id} className="flex min-h-[50px] items-center gap-2.5 border-b border-border-subtle py-1.5 last:border-b-0">
                    <div className="flex-1">
                      <span className="block text-[15px]">{t.name}</span>
                      <span className="text-xs text-muted">
                        {t.n} vragen{t.done ? ` · ${t.done} geprobeerd` : ""}
                      </span>
                    </div>
                    {t.done >= t.n ? (
                      <span className="text-[13px] text-accent">✓ Gedaan</span>
                    ) : (
                      <Link
                        href={`/oefentoets/pretest/${t.id}`}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-[9px] border border-border-strong px-3 text-[13px] font-medium transition-colors hover:bg-surface-2 motion-reduce:transition-none md:min-h-[34px]"
                      >
                        Start pretest
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="proeftoets" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-5 md:px-6 md:py-[22px]">
            <h2 id="proeftoets" className="font-serif text-2xl font-medium">
              Proeftoets
            </h2>
            <p className="text-sm leading-normal text-text-2">Gemengd over de thema&apos;s die je kiest. Je ziet het resultaat per leerdoel pas na inleveren.</p>
            <form action={startExam} className="flex flex-col gap-3">
              <fieldset className="border-t border-border-subtle">
                <legend className="sr-only">Thema&apos;s</legend>
                {sorted.map((t) => {
                  const n = count(t.id, "exam").length;
                  return (
                    <label key={t.id} className={`flex min-h-11 items-center gap-3 ${n === 0 ? "opacity-45" : "cursor-pointer"}`}>
                      <span className="relative flex h-5 w-5 shrink-0">
                        <input
                          type="checkbox"
                          name="topic"
                          value={t.id}
                          disabled={n === 0}
                          aria-label={`${t.name} in proeftoets`}
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-border-dashed bg-surface checked:border-accent checked:bg-accent disabled:cursor-not-allowed"
                        />
                        <Icon d="M4 12l5 5L20 6" size={13} strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto hidden text-accent-text peer-checked:block" />
                      </span>
                      <span className="flex-1 text-[15px]">{t.name}</span>
                      <span className="text-[13px] tabular-nums text-muted">{n} toetsvragen</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="mt-1 flex items-end gap-2.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-bold">Aantal vragen</span>
                  <Select name="n" defaultValue={String(EXAM_DEFAULT)} className="w-24">
                    {[10, 20, 30, 40, 60].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button variant="primary" className="flex-1">
                  Start proeftoets
                </Button>
              </div>
            </form>
          </section>
        </div>

        {sorted.length > 0 ? (
          <details className="rounded-2xl border border-border bg-surface px-5 py-4 md:px-6">
            <summary className="flex min-h-8 cursor-pointer items-center text-[15px] font-bold">Vragen laten maken door AI</summary>
            <div className="mt-3">
              <AiQuestionsForm topics={sorted.map((t) => ({ id: t.id, label: `${t.modules?.name ?? ""} · ${t.name}` }))} enabled={aiConfigured()} />
            </div>
          </details>
        ) : null}
      </div>
    </>
  );
}
