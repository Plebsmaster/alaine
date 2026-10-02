"use client";

import { useState, useTransition } from "react";
import { Button, Field, Notice, Panel, Textarea } from "@/components/ui";
import { stopcheckAction, stopcheckCardAction } from "./actions";

export type StopItem = { cardId: string; rating: number; errorType: string | null; answer: string | null; front: string };

/**
 * Stopcheck (Aanvulling 01, A8): maximaal vijf punten om te onthouden, uit de fouten van
 * deze sessie. Elk punt kan een conceptkaart worden; de vraag schrijf je zelf.
 * Zonder AI: de kaarten die je met Opnieuw of Moeilijk beoordeelde.
 */
export function Stopcheck({ items, aiEnabled }: { items: StopItem[]; aiEnabled: boolean }) {
  const [points, setPoints] = useState<{ text: string; item_ref: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (items.length === 0) return null;

  if (!aiEnabled) {
    return (
      <Panel className="space-y-2">
        <p className="font-medium">Om te onthouden</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.slice(0, 5).map((i) => (
            <li key={i.cardId}>{i.front}</li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-3">
      <p className="font-medium">Stopcheck</p>
      {points === null ? (
        <>
          <p className="text-sm text-muted">
            Je had {items.length} {items.length === 1 ? "kaart" : "kaarten"} fout of moeilijk. Laat de belangrijkste punten op een rij zetten.
          </p>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await stopcheckAction(items.map((i) => ({ cardId: i.cardId, rating: i.rating, errorType: i.errorType, answer: i.answer }))).catch(() => null);
                if (res?.ok) setPoints(res.points);
                else setError(res?.error ?? "Geen verbinding. Probeer het opnieuw.");
              })
            }
          >
            {pending ? "Bezig…" : "Wat moet ik onthouden?"}
          </Button>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </>
      ) : (
        <ol className="space-y-3">
          {points.map((p, i) => (
            <StopPoint key={i} point={p} fallbackCardId={items[0].cardId} validIds={new Set(items.map((x) => x.cardId))} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

function StopPoint({
  point,
  fallbackCardId,
  validIds,
}: {
  point: { text: string; item_ref: string };
  fallbackCardId: string;
  validIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  const [pending, start] = useTransition();
  const cardId = validIds.has(point.item_ref) ? point.item_ref : fallbackCardId;

  return (
    <li className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <p>{point.text}</p>
      {state === "done" ? (
        <p className="text-good">Conceptkaart gemaakt; staat op Goedkeuren.</p>
      ) : open ? (
        <div className="space-y-2">
          <Field label="Vraag (voorkant)" hint="Zet het in je eigen woorden: een vraag die het antwoord afdwingt.">
            <Textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} />
          </Field>
          <Button
            disabled={pending || !front.trim()}
            onClick={() =>
              start(async () => {
                const res = await stopcheckCardAction({ cardId, front, back: point.text }).catch(() => null);
                setState(res?.ok ? "done" : (res?.error ?? "Mislukt"));
              })
            }
          >
            Opslaan als concept
          </Button>
          {state !== "idle" ? <p className="text-danger">{state}</p> : null}
        </div>
      ) : (
        <Button onClick={() => setOpen(true)}>Maak kaart</Button>
      )}
    </li>
  );
}
