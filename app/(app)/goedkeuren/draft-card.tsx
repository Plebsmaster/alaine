"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Field, Notice, Panel, Textarea } from "@/components/ui";
import { CARD_TYPE_LABELS } from "@/lib/labels";
import { approveCardAction, rejectCardAction } from "./actions";

export type Draft = {
  id: string;
  type: string;
  front: string;
  back: string;
  explanation: string | null;
  origin: string;
  flag_note: string | null;
  source: string | null;
  objectives: string[];
};

const ORIGIN = { import: "geïmporteerd", ai: "AI-concept", manual: "eigen concept" } as Record<string, string>;

export function DraftCard({ draft }: { draft: Draft }) {
  const [front, setFront] = useState(draft.front);
  const [back, setBack] = useState(draft.back);
  const [explanation, setExplanation] = useState(draft.explanation ?? "");
  const [state, setState] = useState<"open" | "approved" | "rejected" | "later">("open");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (state !== "open") {
    const msg = { approved: "Goedgekeurd: staat in de herhaling.", rejected: "Afgewezen en verwijderd.", later: "Bewaard voor later." }[state];
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
        <span className="line-clamp-1">{msg} {front}</span>
        {state === "later" ? (
          <button className="underline" onClick={() => setState("open")}>Toch nu</button>
        ) : null}
      </div>
    );
  }

  const changed = front.trim() !== draft.front || back.trim() !== draft.back || explanation.trim() !== (draft.explanation ?? "");

  return (
    <Panel className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{CARD_TYPE_LABELS[draft.type] ?? draft.type}</Badge>
        <Badge>{ORIGIN[draft.origin] ?? draft.origin}</Badge>
        {changed ? <Badge>aangepast</Badge> : null}
      </div>
      {draft.flag_note ? <Notice tone="error">Klopt niet: {draft.flag_note}</Notice> : null}
      <Field label="Voorkant">
        <Textarea value={front} onChange={(e) => setFront(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Achterkant">
        <Textarea value={back} onChange={(e) => setBack(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Uitleg">
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
      </Field>
      {draft.source || draft.objectives.length ? (
        <p className="text-xs text-muted">
          {draft.source ? `Bron: ${draft.source}` : null}
          {draft.source && draft.objectives.length ? " · " : null}
          {draft.objectives.length ? `Leerdoel ${draft.objectives.join(", ")}` : null}
        </p>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await approveCardAction({ id: draft.id, front, back, explanation });
              if (res.ok) setState("approved");
              else setError(res.error);
            })
          }
        >
          Goedkeuren
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setState("later")}>
          Later
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm("Dit concept verwijderen?")) return;
              const res = await rejectCardAction(draft.id);
              if (res.ok) setState("rejected");
              else setError(res.error);
            })
          }
        >
          Afwijzen
        </Button>
      </div>
    </Panel>
  );
}
