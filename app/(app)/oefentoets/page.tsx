import type { Metadata } from "next";
import Link from "next/link";
import { Button, LinkButton, Notice, PageHeader, Panel, Select } from "@/components/ui";
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

  return (
    <>
      <PageHeader title="Oefentoets">
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/oefentoets/vragen">Alle vragen</LinkButton>
          <LinkButton href="/oefentoets/vraag/nieuw">Nieuwe vraag</LinkButton>
        </div>
      </PageHeader>
      <div className="space-y-6">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {drafts > 0 ? (
          <Notice>
            {drafts} conceptvra(a)g(en) wachten op <Link className="underline" href="/goedkeuren">Goedkeuren</Link>.
          </Notice>
        ) : null}

        <Panel className="space-y-3">
          <h2 className="font-semibold">Pretest</h2>
          <p className="text-sm text-muted">
            Doe de pretest vóórdat je aan een thema begint. Je ziet na elke vraag het modelantwoord; er is geen score. Proberen helpt je de stof daarna beter te onthouden.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sorted.map((t) => {
              const qs = count(t.id, "pretest");
              const done = qs.filter((q) => tried.has(q.id)).length;
              return (
                <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {t.name}
                    <span className="ml-2 text-xs text-muted">
                      {qs.length} vragen{done ? ` · ${done} geprobeerd` : ""}
                    </span>
                  </span>
                  {qs.length > 0 ? (
                    <Link href={`/oefentoets/pretest/${t.id}`} className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">
                      Start pretest
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="space-y-3">
          <h2 className="font-semibold">Proeftoets</h2>
          <p className="text-sm text-muted">Gemengd over de thema&apos;s die je kiest. Je ziet het resultaat per leerdoel pas na inleveren.</p>
          <form action={startExam} className="space-y-3">
            <fieldset className="space-y-1">
              <legend className="sr-only">Thema&apos;s</legend>
              {sorted.map((t) => {
                const n = count(t.id, "exam").length;
                return (
                  <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="topic" value={t.id} disabled={n === 0} className="h-5 w-5" aria-label={`${t.name} in proeftoets`} />
                    <span className={n === 0 ? "text-muted" : undefined}>
                      {t.name} <span className="text-xs text-muted">({n} toetsvragen)</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span className="block font-medium">Aantal vragen</span>
                <Select name="n" defaultValue={String(EXAM_DEFAULT)} className="w-24">
                  {[10, 20, 30, 40, 60].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </label>
              <Button variant="primary">Start proeftoets</Button>
            </div>
          </form>
        </Panel>

        {sorted.length > 0 ? (
          <details className="rounded-xl border border-border bg-surface p-4">
            <summary className="cursor-pointer font-semibold">Vragen laten maken door AI</summary>
            <div className="mt-3">
              <AiQuestionsForm topics={sorted.map((t) => ({ id: t.id, label: `${t.modules?.name ?? ""} · ${t.name}` }))} enabled={aiConfigured()} />
            </div>
          </details>
        ) : null}
      </div>
    </>
  );
}
