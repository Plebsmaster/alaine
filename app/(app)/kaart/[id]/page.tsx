import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardFields } from "@/components/card-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Notice, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatInterval } from "@/lib/fsrs";
import { safeReturn } from "@/lib/forms";
import { deleteCard, setCardStatus, updateCard } from "../actions";

export const metadata: Metadata = { title: "Kaart bewerken" };

const STATUS_LABELS: Record<string, string> = { active: "Actief", draft: "Concept", suspended: "Geschorst" };
const ORIGIN_LABELS: Record<string, string> = { manual: "zelf gemaakt", ai: "AI-concept", import: "geïmporteerd" };

export default async function CardPage({ params, searchParams }: PageProps<"/kaart/[id]">) {
  const { id } = await params;
  const { terug } = await searchParams;
  const back = safeReturn(terug, "");
  const { supabase } = await requireUser();

  const { data: card } = await supabase
    .from("cards")
    .select(
      "id, topic_id, type, front, back, explanation, source_locator, tags, status, origin, rewritten, flag_note, topics(name), sources(title, chapter), card_objectives(objective_id), card_schedule(due, reps, lapses, state)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!card) notFound();

  const { data: objectives } = await supabase
    .from("learning_objectives")
    .select("id, code, description")
    .eq("topic_id", card.topic_id)
    .order("sort_order");

  const s = card.card_schedule;
  const returnTo = back || `/thema/${card.topic_id}`;

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href={returnTo} className="underline">Terug</Link> · {card.topics?.name}
      </p>
      <PageHeader title="Kaart bewerken">
        <div className="flex flex-wrap gap-2">
          <Badge>{STATUS_LABELS[card.status]}</Badge>
          <Badge>{ORIGIN_LABELS[card.origin]}</Badge>
          {card.rewritten ? <Badge>in eigen woorden</Badge> : null}
        </div>
      </PageHeader>

      {card.flag_note ? (
        <div className="mb-4">
          <Notice tone="error">Gemarkeerd als &quot;klopt niet&quot;: {card.flag_note}</Notice>
        </div>
      ) : null}

      <Panel className="mb-6">
        <form action={updateCard} className="space-y-4">
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="terug" value={returnTo} />
          <CardFields card={card} objectives={objectives ?? []} selected={card.card_objectives.map((o) => o.objective_id)} />
          {card.sources ? (
            <p className="text-xs text-muted">
              Bron: {card.sources.title}
              {card.sources.chapter ? `, h. ${card.sources.chapter}` : ""}
            </p>
          ) : null}
          <Button variant="primary">Opslaan</Button>
        </form>
      </Panel>

      {s ? (
        <p className="mb-6 text-sm text-muted">
          {s.reps} keer herhaald · {s.lapses} keer vergeten ·{" "}
          {s.state === 0 ? "nog niet gezien" : `volgende herhaling over ${formatInterval(new Date(), new Date(s.due))}`}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {card.status !== "active" ? (
          <form action={setCardStatus}>
            <input type="hidden" name="id" value={card.id} />
            <input type="hidden" name="status" value="active" />
            <Button>{card.status === "draft" ? "Goedkeuren" : "Weer activeren"}</Button>
          </form>
        ) : null}
        {card.status === "active" ? (
          <form action={setCardStatus}>
            <input type="hidden" name="id" value={card.id} />
            <input type="hidden" name="status" value="suspended" />
            <Button>Schorsen</Button>
          </form>
        ) : null}
        <form action={deleteCard}>
          <input type="hidden" name="id" value={card.id} />
          <ConfirmButton variant="danger" message="Kaart en alle herhalingen ervan verwijderen?">
            Verwijderen
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
