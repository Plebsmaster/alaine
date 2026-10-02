"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CARD_TYPE_OPTIONS } from "@/components/card-form";
import { Icon } from "@/components/nav";
import { Badge, Button, Eyebrow, Input, Kbd, Notice, Textarea } from "@/components/ui";
import { CARD_TYPE_LABELS, ORIGIN_LABELS, VERIFY_TEXT } from "@/lib/labels";
import { approveCardAction, rejectCardAction } from "./actions";

export type DraftCardItem = {
  id: string;
  topicId: string;
  topicName: string;
  type: string;
  front: string;
  back: string;
  explanation: string | null;
  tags: string[];
  sourceLocator: string | null;
  sourceExcerpt: string | null;
  sourceLabel: string | null;
  origin: string;
  flagNote: string | null;
  needsVerification: boolean;
  objectives: { code: string | null; description: string }[];
};

type Edit = {
  type: string;
  front: string;
  back: string;
  explanation: string;
  tags: string;
  sourceLocator: string;
  verified: boolean;
};

type CardType = Parameters<typeof approveCardAction>[0]["type"];

const editOf = (c: DraftCardItem): Edit => ({
  type: c.type,
  front: c.front,
  back: c.back,
  explanation: c.explanation ?? "",
  tags: c.tags.join(", "),
  sourceLocator: c.sourceLocator ?? "",
  verified: false,
});

/** Groepen per thema, in de volgorde waarin de thema's voor het eerst voorkomen. */
function byTopic(list: DraftCardItem[]) {
  const out: { topicId: string; name: string; items: DraftCardItem[] }[] = [];
  for (const c of list) {
    const g = out.find((x) => x.topicId === c.topicId);
    if (g) g.items.push(c);
    else out.push({ topicId: c.topicId, name: c.topicName, items: [c] });
  }
  return out;
}

/** Telefoonkop: terug, titel en positie. Op laptop staat Goedkeuren al in de subnavigatie. */
export function PhoneHeader({ position }: { position?: string }) {
  return (
    <div className="flex items-center gap-2 px-2 pt-2 md:hidden">
      <Link href="/themas" aria-label="Terug naar Studiestof" className="flex h-11 w-11 items-center justify-center rounded-[10px] text-text-2">
        <Icon d="M15 6l-6 6 6 6" size={22} />
      </Link>
      <h1 className="text-[17px] font-bold">Goedkeuren</h1>
      {position ? <span className="ml-auto pr-2 text-sm tabular-nums text-muted">{position}</span> : null}
    </div>
  );
}

/**
 * Goedkeuren als triage (ontwerp 1n): lijst links, bron naast het concept, sneltoetsen
 * A (goedkeuren), L (later), X (afwijzen) en ↑/↓ of j/k. Na een actie direct het volgende.
 * Telefoon: één concept tegelijk met een eigen actiebalk.
 */
export function CardTriage({ items, initialId, header }: { items: DraftCardItem[]; initialId: string | null; header: ReactNode }) {
  const [list, setList] = useState(items);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ordered = byTopic(items).flatMap((g) => g.items);
    return initialId && items.some((i) => i.id === initialId) ? initialId : (ordered[0]?.id ?? null);
  });
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // De lijst toont groepen per thema; navigeren en "i van n" volgen dezelfde volgorde.
  const groups = useMemo(() => byTopic(list), [list]);
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const index = ordered.findIndex((i) => i.id === selectedId);
  const current = index >= 0 ? ordered[index] : null;
  const edit = current ? (edits[current.id] ?? editOf(current)) : null;

  // Selectie in de URL (?id=), zonder opnieuw te laden.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("id", selectedId);
    else url.searchParams.delete("id");
    window.history.replaceState(window.history.state, "", url);
  }, [selectedId]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setMore(false);
    setSheet(false);
    setError(null);
  }, []);

  const move = useCallback(
    (step: number) => {
      if (ordered.length === 0) return;
      const next = ordered[Math.min(ordered.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))];
      select(next.id);
      document.querySelector(`[data-item="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
    },
    [ordered, index, select],
  );

  const update = (patch: Partial<Edit>) => {
    if (!current || !edit) return;
    setEdits((e) => ({ ...e, [current.id]: { ...edit, ...patch } }));
  };

  /** Optimistisch: het concept verdwijnt meteen en het volgende staat klaar. Bij een fout komt het terug. */
  const removeAndAdvance = useCallback(
    (card: DraftCardItem) => {
      const i = ordered.findIndex((x) => x.id === card.id);
      const at = list.findIndex((x) => x.id === card.id);
      const rest = ordered.filter((x) => x.id !== card.id);
      setList((l) => l.filter((x) => x.id !== card.id));
      select(rest[Math.min(i, rest.length - 1)]?.id ?? null);
      return (message: string) => {
        setList((l) => (l.some((x) => x.id === card.id) ? l : [...l.slice(0, at), card, ...l.slice(at)]));
        select(card.id);
        setError(message);
      };
    },
    [ordered, list, select],
  );

  const approve = useCallback(() => {
    if (!current || !edit || pending) return;
    const card = current;
    const e = edit;
    const restore = removeAndAdvance(card);
    start(async () => {
      const res = await approveCardAction({
        id: card.id,
        front: e.front,
        back: e.back,
        explanation: e.explanation,
        verified: e.verified,
        type: e.type as CardType,
        tags: e.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source_locator: e.sourceLocator,
      }).catch(() => ({ ok: false as const, error: "Geen verbinding. Probeer het opnieuw." }));
      if (!res.ok) restore(res.error);
    });
  }, [current, edit, pending, removeAndAdvance]);

  const later = useCallback(() => {
    if (!current) return;
    const rest = [...list.filter((x) => x.id !== current.id), current];
    const restOrdered = byTopic(rest).flatMap((g) => g.items);
    // Achteraan in zijn thema; het volgende concept schuift op deze plek (of terug naar het begin).
    const here = restOrdered[index];
    const next = here?.id === current.id ? (restOrdered[index + 1] ?? restOrdered[0]) : here;
    setList(rest);
    select(next?.id ?? current.id);
  }, [current, list, index, select]);

  const reject = useCallback(() => {
    if (!current || pending) return;
    if (!window.confirm("Dit concept verwijderen?")) return;
    const card = current;
    const restore = removeAndAdvance(card);
    start(async () => {
      const res = await rejectCardAction(card.id).catch(() => ({ ok: false as const, error: "Geen verbinding. Probeer het opnieuw." }));
      if (!res.ok) restore(res.error);
    });
  }, [current, pending, removeAndAdvance]);

  // Sneltoetsen alleen als de focus niet in een veld staat; in een veld ⌘/Ctrl+Enter = goedkeuren.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const el = e.target as HTMLElement;
      const typing = el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable;
      if (typing) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          approve();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "escape" && sheet) setSheet(false);
      else if (k === "a") approve();
      else if (k === "l") later();
      else if (k === "x") reject();
      else if (k === "arrowdown" || k === "j") move(1);
      else if (k === "arrowup" || k === "k") move(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, later, reject, move, sheet]);

  const position = current ? `${index + 1} van ${ordered.length}` : undefined;

  return (
    <>
      <PhoneHeader position={position} />

      {/* Lijst met concepten (alleen laptop); de kop met soort en filters ook op telefoon. */}
      <div className="flex flex-col md:min-h-0 md:w-[330px] md:shrink-0 md:border-r md:border-border md:bg-surface">
        {header}
        <nav aria-label="Concepten" className="hidden min-h-0 flex-1 overflow-y-auto md:block">
          {groups.map((g) => (
            <div key={g.topicId}>
              <Eyebrow className="px-4 pb-1.5 pt-3.5">
                {g.name} · {g.items.length}
              </Eyebrow>
              <ul>
                {g.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      data-item={c.id}
                      onClick={() => select(c.id)}
                      aria-current={c.id === selectedId ? "true" : undefined}
                      className="flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-[11px] text-left transition-colors hover:bg-surface-2 motion-reduce:transition-none aria-[current=true]:bg-accent-soft"
                    >
                      <span className="line-clamp-2 text-sm leading-[1.4]">{(edits[c.id]?.front ?? c.front) || "–"}</span>
                      <span className="text-xs text-muted">
                        {CARD_TYPE_LABELS[c.type] ?? c.type} · {ORIGIN_LABELS[c.origin] ?? c.origin}
                        {c.needsVerification ? <span className="font-bold text-warn-text"> · Controleren</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {!current || !edit ? (
        <section aria-label="Concept nakijken" className="flex flex-1 items-center justify-center p-8">
          <p role="status" className="text-center text-muted">
            {pending ? "Opslaan…" : "Geen kaartconcepten om na te kijken."}
          </p>
        </section>
      ) : (
        <section aria-label="Concept nakijken" className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-4 px-4 pb-32 pt-3 md:grid md:min-h-0 md:flex-1 md:grid-cols-2 md:gap-0 md:overflow-y-auto md:p-0">
            {/* Bron. Telefoon (1n): tussen de chips en de velden. */}
            <div className="rounded-[14px] border border-border bg-surface-sunk px-3.5 py-3 max-md:order-1 md:flex md:flex-col md:gap-3.5 md:rounded-none md:border-0 md:border-r md:px-[30px] md:py-7">
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow>
                  Bron
                  {current.sourceLocator ? <span className="md:hidden"> · {current.sourceLocator}</span> : null}
                </Eyebrow>
                {current.sourceLabel ? <span className="hidden text-right text-[13px] text-muted md:inline">{current.sourceLabel}</span> : null}
                {current.sourceExcerpt ? (
                  <button type="button" onClick={() => setSheet(true)} className="min-h-8 text-xs font-bold text-accent md:hidden">
                    Hele bron
                  </button>
                ) : null}
              </div>
              {current.sourceExcerpt ? (
                <>
                  <p className="prose-card mt-1.5 line-clamp-3 font-serif text-[15px] leading-normal text-text-2 md:mt-0 md:line-clamp-none md:text-lg md:leading-[1.6]">
                    <mark className="rounded-[3px] bg-highlight px-0.5 text-text">{current.sourceExcerpt}</mark>
                  </p>
                  <p className="mt-auto hidden text-[13px] text-muted md:block">
                    Gemarkeerd: {current.origin === "ai" ? "waar de AI dit concept op baseerde." : "waar dit concept op rust."}
                  </p>
                </>
              ) : (
                <div className="mt-1 space-y-1 text-sm text-muted md:mt-0">
                  {current.sourceLabel ? <p className="md:hidden">{current.sourceLabel}</p> : null}
                  <p>Brontekst niet bewaard bij dit concept.</p>
                </div>
              )}
            </div>

            {/* Concept. Op de telefoon schuiven de onderdelen los in de kolom, zodat de bron ertussen past. */}
            <div className="max-md:contents md:flex md:flex-col md:gap-4 md:px-[30px] md:py-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted md:hidden">{current.topicName} ·</span>
                <select
                  aria-label="Type"
                  value={edit.type}
                  onChange={(e) => update({ type: e.target.value })}
                  className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-[13px] text-text"
                >
                  {CARD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted">{ORIGIN_LABELS[current.origin] ?? current.origin}</span>
                {current.objectives.map((o) => (
                  <span key={`${o.code}-${o.description}`} title={o.description}>
                    <Badge tone="accent">{o.code ?? o.description.slice(0, 24)}</Badge>
                  </span>
                ))}
                {edit.front.trim() !== current.front || edit.back.trim() !== current.back ? (
                  <span className="ml-auto text-xs font-bold text-accent">Herschreven</span>
                ) : null}
              </div>

              {current.needsVerification ? (
                <div className="space-y-1.5 text-[13px] text-warn-text">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">Controleren</Badge>
                    {VERIFY_TEXT}
                  </p>
                  <label className="flex min-h-9 items-center gap-2 text-text-2">
                    <input type="checkbox" checked={edit.verified} onChange={(e) => update({ verified: e.target.checked })} className="h-4 w-4" />
                    Ik heb dit gecontroleerd
                  </label>
                </div>
              ) : null}
              {current.flagNote ? <Notice tone="error">Klopt niet: {current.flagNote}</Notice> : null}

              <label className="block space-y-1.5 max-md:order-2">
                <span className="text-[13px] font-bold md:text-sm">Voorkant</span>
                <Textarea
                  value={edit.front}
                  onChange={(e) => update({ front: e.target.value })}
                  maxLength={2000}
                  className="font-serif text-lg leading-[1.35] md:text-xl"
                />
                <span className="block text-xs text-muted">Dwing ophalen af: geen ja/nee-vraag, het antwoord staat niet in de vraag.</span>
              </label>
              <label className="block space-y-1.5 max-md:order-2">
                <span className="text-[13px] font-bold md:text-sm">Achterkant</span>
                <Textarea value={edit.back} onChange={(e) => update({ back: e.target.value })} maxLength={2000} className="text-[15px] leading-[1.55]" />
                <span className="block text-xs text-muted">Zet het in je eigen woorden; dat onthoud je beter.</span>
              </label>

              {more ? (
                <div className="space-y-3 max-md:order-2">
                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-bold md:text-sm">Uitleg</span>
                    <Textarea value={edit.explanation} onChange={(e) => update({ explanation: e.target.value })} rows={2} />
                  </label>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-bold md:text-sm">Tags</span>
                      <Input value={edit.tags} onChange={(e) => update({ tags: e.target.value })} placeholder="Gescheiden door komma's" />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-bold md:text-sm">Bronvermelding</span>
                      <Input value={edit.sourceLocator} onChange={(e) => update({ sourceLocator: e.target.value })} placeholder="Bijv. p. 412 of dia 23" />
                    </label>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setMore(true)} className="min-h-8 self-start text-[13px] text-muted hover:text-text max-md:order-2">
                  + Uitleg · + Tags{edit.explanation ? " (uitleg ingevuld)" : ""}
                </button>
              )}

              {error ? (
                <div className="max-md:order-2">
                  <Notice tone="error">{error}</Notice>
                </div>
              ) : null}
            </div>
          </div>

          {/* Actiebalk: telefoon vast onderin, laptop onder de editor. */}
          <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[56px_1fr_1.5fr] gap-2 border-t border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 md:static md:z-auto md:flex md:h-[72px] md:shrink-0 md:items-center md:gap-2.5 md:px-[30px] md:py-0">
            <span className="hidden text-sm tabular-nums text-muted md:inline">{position}</span>
            <Button variant="danger" aria-label="Afwijzen" onClick={reject} disabled={pending} className="h-14 border border-border-strong md:ml-auto md:h-11 md:border-0">
              <Icon d="M6 6l12 12M18 6L6 18" size={20} className="md:hidden" />
              <span className="hidden md:inline">Afwijzen</span>
              <span aria-hidden className="hidden md:inline-flex">
                <Kbd>X</Kbd>
              </span>
            </Button>
            <Button onClick={later} disabled={pending} className="h-14 md:h-11">
              Later
              <span aria-hidden className="hidden md:inline-flex">
                <Kbd>L</Kbd>
              </span>
            </Button>
            <Button variant="primary" onClick={approve} disabled={pending} className="h-14 md:h-11">
              Goedkeuren
              <span aria-hidden className="hidden md:inline-flex">
                <Kbd onPrimary>A</Kbd>
              </span>
            </Button>
          </div>

          {/* Telefoon: de hele bewaarde bron in een sheet. */}
          {sheet && current.sourceExcerpt ? (
            <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Bron">
              <button type="button" aria-label="Sluiten" onClick={() => setSheet(false)} className="absolute inset-0 bg-text/30" />
              <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>Bron</Eyebrow>
                  <button type="button" onClick={() => setSheet(false)} className="min-h-11 px-2 text-sm font-bold text-accent">
                    Sluiten
                  </button>
                </div>
                {current.sourceLabel ? <p className="text-[13px] text-muted">{current.sourceLabel}</p> : null}
                <p className="prose-card mt-3 font-serif text-[17px] leading-[1.6] text-text-2">
                  <mark className="rounded-[3px] bg-highlight px-0.5 text-text">{current.sourceExcerpt}</mark>
                </p>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
