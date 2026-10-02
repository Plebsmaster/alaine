import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardFields } from "@/components/card-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Field, Input, PageHeader, Panel, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createCard } from "../../kaart/actions";
import { deleteTopic, updateTopic } from "../../themas/actions";
import { createObjective, deleteObjective, updateObjective } from "./actions";

export const metadata: Metadata = { title: "Thema" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STATUS_LABELS: Record<string, string> = { active: "Actief", draft: "Concept", suspended: "Geschorst" };

export default async function TopicPage({ params, searchParams }: PageProps<"/thema/[id]">) {
  const { id } = await params;
  const { status: statusParam } = await searchParams;
  const status = typeof statusParam === "string" && statusParam in STATUS_LABELS ? statusParam : "active";
  const { supabase } = await requireUser();

  const [{ data: topic }, { data: objectives }, { data: coverage }, { data: counts }, { data: cards }] = await Promise.all([
    supabase.from("topics").select("id, name, sort_order, modules(name)").eq("id", id).maybeSingle(),
    supabase.from("learning_objectives").select("id, code, description, sort_order").eq("topic_id", id).order("sort_order"),
    supabase.from("objective_coverage").select("*").eq("topic_id", id),
    supabase.from("topic_card_counts").select("*").eq("topic_id", id).maybeSingle(),
    supabase
      .from("cards")
      .select("id, type, front, status, flag_note, card_schedule(lapses)")
      .eq("topic_id", id)
      .eq("status", status)
      .order("created_at")
      .limit(500),
  ]);
  if (!topic) notFound();
  const cov = new Map((coverage ?? []).map((c) => [c.objective_id, c]));
  const uncovered = (objectives ?? []).filter((o) => !(cov.get(o.id)?.active_cards || cov.get(o.id)?.active_cases));

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/themas" className="underline">Thema&apos;s</Link> · {topic.modules?.name}
      </p>
      <PageHeader title={topic.name}>
        <div className="flex gap-2 text-sm text-muted">
          <span>{counts?.active ?? 0} actief</span>·<span>{counts?.draft ?? 0} concept</span>
        </div>
      </PageHeader>

      <section className="mb-8 space-y-3">
        <h2 className="text-lg font-semibold">Leerdoelen en dekking</h2>
        {uncovered.length > 0 && (objectives ?? []).length > 0 ? (
          <p className="text-sm text-danger">
            {uncovered.length} van {(objectives ?? []).length} leerdoelen hebben nog geen actieve kaart of casus.
          </p>
        ) : null}
        <ul className="space-y-2">
          {(objectives ?? []).map((o) => {
            const c = cov.get(o.id);
            const covered = !!(c?.active_cards || c?.active_cases);
            return (
              <li key={o.id} className={`rounded-lg border bg-surface p-3 ${covered ? "border-border" : "border-danger"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">
                    {o.code ? <strong>{o.code} </strong> : null}
                    {o.description}
                  </p>
                  <span className={`shrink-0 text-xs ${covered ? "text-muted" : "text-danger"}`}>
                    {plural(c?.active_cards ?? 0, "kaart", "kaarten")} · {plural(c?.active_cases ?? 0, "casus", "casussen")}
                  </span>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-muted">Bewerken</summary>
                  <form action={updateObjective} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="topic_id" value={id} />
                    <div className="grid grid-cols-[6rem_1fr_5rem] gap-2">
                      <Input name="code" defaultValue={o.code ?? ""} aria-label="Code" />
                      <Input name="description" defaultValue={o.description} aria-label="Omschrijving" required />
                      <Input name="sort_order" type="number" defaultValue={o.sort_order} aria-label="Volgorde" />
                    </div>
                    <div className="flex gap-2">
                      <Button>Opslaan</Button>
                      <ConfirmButton variant="danger" formAction={deleteObjective} message="Leerdoel verwijderen?">
                        Verwijderen
                      </ConfirmButton>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Leerdoel toevoegen</summary>
          <form action={createObjective} className="mt-2 space-y-2">
            <input type="hidden" name="topic_id" value={id} />
            <div className="grid grid-cols-[6rem_1fr_5rem] gap-2">
              <Input name="code" placeholder="2.1" aria-label="Code" />
              <Textarea name="description" placeholder="Letterlijk uit de studiehandleiding" aria-label="Omschrijving" required rows={2} />
              <Input name="sort_order" type="number" defaultValue={(objectives?.length ?? 0) + 1} aria-label="Volgorde" />
            </div>
            <Button>Toevoegen</Button>
          </form>
        </details>
      </section>

      <section className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Kaarten</h2>
          <nav className="flex gap-1 text-sm" aria-label="Filter op status">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Link
                key={key}
                href={`/thema/${id}?status=${key}`}
                aria-current={status === key ? "page" : undefined}
                className="rounded-lg px-3 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {status === "draft" && (cards ?? []).length > 0 ? (
          <p className="text-sm">
            <Link className="underline" href={`/goedkeuren?thema=${id}`}>Concepten nakijken en goedkeuren</Link>
          </p>
        ) : null}
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {(cards ?? []).length === 0 ? <li className="px-4 py-3 text-sm text-muted">Geen kaarten met deze status.</li> : null}
          {(cards ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/kaart/${c.id}?terug=${encodeURIComponent(`/thema/${id}?status=${status}`)}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                <span className="line-clamp-2 text-sm">{c.front}</span>
                <span className="flex shrink-0 gap-1">
                  {c.flag_note ? <Badge>klopt niet</Badge> : null}
                  {(c.card_schedule?.lapses ?? 0) >= 4 ? <Badge>lastig</Badge> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Panel className="mb-8">
        <h2 className="mb-3 font-semibold">Eigen kaart toevoegen</h2>
        <form action={createCard} className="space-y-3">
          <input type="hidden" name="topic_id" value={id} />
          <CardFields objectives={objectives ?? []} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activate" defaultChecked className="h-4 w-4" />
            Direct in de herhaling (zelf geschreven, dus geen goedkeuring nodig)
          </label>
          <Button variant="primary">Kaart toevoegen</Button>
        </form>
      </Panel>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Thema bewerken</summary>
        <form action={updateTopic} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Naam">
              <Input name="name" defaultValue={topic.name} required />
            </Field>
            <Field label="Volgorde">
              <Input name="sort_order" type="number" defaultValue={topic.sort_order} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button>Opslaan</Button>
            <ConfirmButton variant="danger" formAction={deleteTopic} message={`Thema "${topic.name}" met alle kaarten en herhalingen verwijderen?`}>
              Thema verwijderen
            </ConfirmButton>
          </div>
        </form>
      </details>
    </>
  );
}
