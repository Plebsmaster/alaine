import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Notice, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { ExpertReflection } from "@/lib/cases";
import { deleteCase, setCaseStatus, updateCase } from "../actions";
import { CaseFields } from "../case-form";

export const metadata: Metadata = { title: "Casus" };

const STATUS: Record<string, string> = { active: "Actief", draft: "Concept", archived: "Gearchiveerd" };
const ORIGIN: Record<string, string> = { manual: "zelf gemaakt", ai: "AI-concept", import: "geïmporteerd" };

export default async function CasePage({ params, searchParams }: PageProps<"/casussen/[id]">) {
  const { id } = await params;
  const { opgeslagen } = await searchParams;
  const { supabase } = await requireUser();
  const { data: c } = await supabase
    .from("cases")
    .select("*, topics(id, name), case_objectives(objective_id), case_attempts(created_at, self_score, correct)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const { data: objectives } = await supabase
    .from("learning_objectives")
    .select("id, code, description")
    .eq("topic_id", c.topic_id)
    .order("sort_order");
  const selected = new Set(c.case_objectives.map((o) => o.objective_id));
  const attempts = [...c.case_attempts].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/casussen" className="underline">Casussen</Link> ·{" "}
        <Link href={`/thema/${c.topics?.id}`} className="underline">{c.topics?.name}</Link>
      </p>
      <PageHeader title={c.title}>
        <div className="flex flex-wrap gap-2">
          <Badge>{STATUS[c.status]}</Badge>
          <Badge>{c.from_internship ? "stage" : ORIGIN[c.origin]}</Badge>
        </div>
      </PageHeader>
      {opgeslagen ? (
        <div className="mb-4">
          <Notice tone="ok">Opgeslagen.</Notice>
        </div>
      ) : null}
      {c.origin === "ai" && c.status === "draft" ? (
        <div className="mb-4">
          <Notice>AI-concept: controleer of de juiste diagnose en de redenering kloppen met je bronnen.</Notice>
        </div>
      ) : null}

      <Panel className="mb-6">
        <form action={updateCase} className="space-y-4">
          <input type="hidden" name="id" value={c.id} />
          <CaseFields value={{ ...c, expert_reflection: c.expert_reflection as ExpertReflection[] }} />
          {(objectives ?? []).length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Leerdoelen</legend>
              {(objectives ?? []).map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="objectives" value={o.id} defaultChecked={selected.has(o.id)} className="mt-1 h-4 w-4" />
                  <span>
                    {o.code ? <strong>{o.code} </strong> : null}
                    {o.description}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {c.status === "draft" ? (
              <Button variant="primary" name="intent" value="approve">
                Opslaan en goedkeuren
              </Button>
            ) : null}
            <Button variant={c.status === "draft" ? "secondary" : "primary"} name="intent" value="save">
              Opslaan
            </Button>
          </div>
        </form>
      </Panel>

      {attempts.length > 0 ? (
        <section className="mb-6 space-y-2">
          <h2 className="text-lg font-semibold">Pogingen</h2>
          <ul className="space-y-1 text-sm">
            {attempts.map((a) => (
              <li key={a.created_at}>
                {new Date(a.created_at).toLocaleDateString("nl-NL")} · zelfscore {a.self_score ?? "–"} ·{" "}
                {a.correct === null ? "–" : a.correct ? "diagnose juist" : "diagnose onjuist"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={setCaseStatus}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="status" value={c.status === "archived" ? "active" : "archived"} />
          <Button>{c.status === "archived" ? "Weer activeren" : "Archiveren"}</Button>
        </form>
        <form action={deleteCase}>
          <input type="hidden" name="id" value={c.id} />
          <ConfirmButton variant="danger" message="Casus en alle pogingen verwijderen?">
            Verwijderen
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
