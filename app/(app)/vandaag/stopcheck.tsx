"use client";

import { useState, useTransition } from "react";
import { Button, Field, Notice, Textarea } from "@/components/ui";
import { stopcheckAction, stopcheckCardAction } from "./actions";

export type StopItem = { cardId: string; rating: number; errorType: string | null; answer: string | null; front: string };

/**
 * Stopcheck (Aanvulling 01, A8): maximaal vijf punten om te onthouden, uit de fouten van
 * deze sessie. Elk punt kan een conceptkaart worden; de vraag schrijf je zelf.
 * Zonder AI: de kaarten die je met Opnieuw of Moeilijk beoordeelde.
 * Inhoud van de kaart "Om te onthouden" op het sessie-einde (ontwerp 1h).
 */
export function Stopcheck({ items, aiEnabled }: { items: StopItem[]; aiEnabled: boolean }) {
  const [points, setPoints] = useState<{ text: string; item_ref: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = items.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-[26px] font-medium leading-[1.2]">Om te onthouden</h2>
        <p className="mt-1 text-sm text-muted">
          {n === 0
            ? "Geen fouten vandaag; niets extra om vast te leggen."
            : aiEnabled
              ? `Uit je ${n} ${n === 1 ? "fout" : "fouten"} van vandaag. Schrijf zelf de vraag; de kaart komt op Goedkeuren.`
              : `De ${n === 1 ? "kaart" : "kaarten"} die je met Opnieuw of Moeilijk beoordeelde.`}
        </p>
      </div>

      {n === 0 ? null : !aiEnabled ? (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {items.slice(0, 5).map((i) => (
            <li key={i.cardId} className="py-3 text-[15px] leading-normal">
              {i.front}
            </li>
          ))}
        </ul>
      ) : points === null ? (
        <>
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
        <ol>
          {points.map((p, i) => (
            <StopPoint key={i} index={i} point={p} fallbackCardId={items[0].cardId} validIds={new Set(items.map((x) => x.cardId))} />
          ))}
        </ol>
      )}
    </div>
  );
}

function StopPoint({
  index,
  point,
  fallbackCardId,
  validIds,
}: {
  index: number;
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
    <li className="flex gap-3.5 border-t border-border-subtle py-3.5">
      <span aria-hidden className="w-[18px] shrink-0 font-serif text-[22px] leading-none text-accent">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] leading-normal">{point.text}</p>
        {state === "done" ? (
          <p className="flex items-center gap-1.5 text-sm text-accent">
            <span aria-hidden>✓</span> Conceptkaart gemaakt; staat op Goedkeuren.
          </p>
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
            {state !== "idle" ? <p className="text-sm text-danger">{state}</p> : null}
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-accent hover:underline">
            Maak kaart <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </li>
  );
}
