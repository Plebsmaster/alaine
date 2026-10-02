import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Notice, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { deleteQuestion, setQuestionStatus, updateQuestion } from "../../actions";
import { QuestionFields } from "../../question-form";

export const metadata: Metadata = { title: "Vraag" };

const STATUS: Record<string, string> = { active: "Actief", draft: "Concept", archived: "Gearchiveerd" };
const ORIGIN: Record<string, string> = { manual: "zelf gemaakt", ai: "AI-concept", import: "geïmporteerd" };

export default async function QuestionPage({ params, searchParams }: PageProps<"/oefentoets/vraag/[id]">) {
  const { id } = await params;
  const { opgeslagen } = await searchParams;
  const { supabase } = await requireUser();
  const { data: q } = await supabase
    .from("questions")
    .select("*, topics(id, name), question_objectives(objective_id)")
    .eq("id", id)
    .maybeSingle();
  if (!q) notFound();
  const { data: objectives } = await supabase.from("learning_objectives").select("id, code, description").eq("topic_id", q.topic_id).order("sort_order");
  const selected = new Set(q.question_objectives.map((o) => o.objective_id));

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/oefentoets/vragen" className="underline">Vragen</Link> · {q.topics?.name}
      </p>
      <PageHeader title="Vraag bewerken">
        <div className="flex gap-2">
          <Badge>{STATUS[q.status]}</Badge>
          <Badge>{ORIGIN[q.origin]}</Badge>
        </div>
      </PageHeader>
      {opgeslagen ? (
        <div className="mb-4">
          <Notice tone="ok">Opgeslagen.</Notice>
        </div>
      ) : null}
      <Panel className="mb-6">
        <form action={updateQuestion} className="space-y-4">
          <input type="hidden" name="id" value={q.id} />
          <QuestionFields value={{ ...q, options: (q.options as string[] | null) ?? null }} />
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
            {q.status === "draft" ? (
              <Button variant="primary" name="intent" value="approve">
                Opslaan en goedkeuren
              </Button>
            ) : null}
            <Button variant={q.status === "draft" ? "secondary" : "primary"} name="intent" value="save">
              Opslaan
            </Button>
          </div>
        </form>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <form action={setQuestionStatus}>
          <input type="hidden" name="id" value={q.id} />
          <input type="hidden" name="status" value={q.status === "archived" ? "active" : "archived"} />
          <Button>{q.status === "archived" ? "Weer activeren" : "Archiveren"}</Button>
        </form>
        <form action={deleteQuestion}>
          <input type="hidden" name="id" value={q.id} />
          <ConfirmButton variant="danger" message="Vraag en alle pogingen verwijderen?">
            Verwijderen
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
