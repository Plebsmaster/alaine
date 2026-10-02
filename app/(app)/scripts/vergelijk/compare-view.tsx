"use client";

import Link from "next/link";
import { type MouseEvent, useState } from "react";
import type { CompareMode } from "@/lib/compare";
import { COMPARE_FIELDS, type ScriptFieldKey } from "../script-labels";

export type CompareScript = { id: string; condition: string; values: Record<ScriptFieldKey, string | null> };

const cellKey = (field: ScriptFieldKey, id: string) => `${field}:${id}`;

/** Afgedekte cel: eerst zelf ophalen, dan openen (muis, Enter of spatie). */
function Cover({ id, label, tall, onReveal }: { id: string; label: string; tall?: boolean; onReveal: (e: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      data-cover={id}
      onClick={onReveal}
      aria-label={`Wat verwacht je? Toon ${label}`}
      className={`flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-err-3 bg-bg text-text-2 transition-colors hover:border-border-dashed motion-reduce:transition-none ${
        tall ? "h-14 text-sm" : "min-h-[42px] text-[13px]"
      }`}
    >
      Wat verwacht je? <b className="text-accent">Toon</b>
    </button>
  );
}

/**
 * Illness scripts naast elkaar (ontwerp 1p): matrix op laptop, per veld op telefoon.
 * Overhoren: de eerste kolom blijft zichtbaar, de andere cellen zijn afgedekt tot je ze opent.
 * Alleen clientstate; er wordt niets opgeslagen.
 */
export function CompareView({ scripts, mode }: { scripts: CompareScript[]; mode: CompareMode }) {
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [field, setField] = useState<ScriptFieldKey>(COMPARE_FIELDS[0].key);
  const quiz = mode === "overhoren";

  const filled = (s: CompareScript, f: ScriptFieldKey) => !!s.values[f]?.trim();
  // Lege cellen hoef je niet op te halen; de eerste kolom is het ankerpunt.
  const coverable = COMPARE_FIELDS.flatMap((f) => scripts.slice(1).filter((s) => filled(s, f.key)).map((s) => cellKey(f.key, s.id)));
  const isCovered = (f: ScriptFieldKey, s: CompareScript, col: number) => quiz && col > 0 && filled(s, f) && !shown.has(cellKey(f, s.id));
  const allShown = coverable.every((k) => shown.has(k));

  const reveal = (key: string) => (e: MouseEvent<HTMLButtonElement>) => {
    // Met het toetsenbord (detail 0) gaat de focus door naar de volgende afgedekte cel.
    const container = e.currentTarget.closest("[data-quiz]");
    const covers = container ? [...container.querySelectorAll<HTMLButtonElement>("[data-cover]")] : [];
    const next = covers[covers.indexOf(e.currentTarget) + 1]?.dataset.cover;
    setShown((prev) => new Set(prev).add(key));
    if (e.detail === 0 && next) requestAnimationFrame(() => container?.querySelector<HTMLButtonElement>(`[data-cover="${next}"]`)?.focus());
  };

  const value = (s: CompareScript, f: ScriptFieldKey) => (filled(s, f) ? <span className="prose-card">{s.values[f]}</span> : <span className="text-muted">–</span>);
  const label = (f: { key: ScriptFieldKey; label: string }, s: CompareScript) => `${f.label.toLowerCase()} bij ${s.condition}`;

  return (
    <>
      {/* Laptop: matrix. */}
      <div data-quiz className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[190px]" />
            {scripts.map((s) => (
              <col key={s.id} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b-2 border-border-strong">
              <td />
              {scripts.map((s) => (
                <th key={s.id} scope="col" className="px-4 py-3 align-bottom font-serif text-xl font-medium leading-[1.25]">
                  <Link href={`/scripts/${s.id}`} className="hover:underline">
                    {s.condition}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_FIELDS.map((f) => (
              <tr key={f.key} className="border-b border-border-subtle last:border-b-0">
                <th
                  scope="row"
                  className={`bg-surface-sunk px-4 py-3 align-top text-xs font-bold uppercase tracking-[.04em] ${
                    f.key === "key_discriminators" ? "text-accent-strong" : "text-muted"
                  }`}
                >
                  {f.label}
                </th>
                {scripts.map((s, col) =>
                  isCovered(f.key, s, col) ? (
                    <td key={s.id} className="p-2 align-top">
                      <Cover id={cellKey(f.key, s.id)} label={label(f, s)} onReveal={reveal(cellKey(f.key, s.id))} />
                    </td>
                  ) : (
                    <td key={s.id} className="px-4 py-3 align-top text-sm leading-[1.45]">
                      {value(s, f.key)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telefoon: één veld tegelijk, per aandoening een kaart. */}
      <div data-quiz className="flex flex-col gap-2.5 md:hidden">
        <div role="group" aria-label="Veld" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {COMPARE_FIELDS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={field === f.key}
              onClick={() => setField(f.key)}
              className="h-10 shrink-0 rounded-full border border-border bg-surface px-3 text-[13px] text-text-2 aria-pressed:border-text aria-pressed:bg-text aria-pressed:font-bold aria-pressed:text-surface"
            >
              {f.label}
            </button>
          ))}
        </div>
        {scripts.map((s, col) => {
          const f = COMPARE_FIELDS.find((x) => x.key === field)!;
          return (
            <section key={s.id} className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-surface px-4 py-3.5">
              <h2 className="font-serif text-[19px] font-medium leading-[1.25]">
                <Link href={`/scripts/${s.id}`}>{s.condition}</Link>
              </h2>
              {isCovered(f.key, s, col) ? (
                <Cover id={cellKey(f.key, s.id)} label={label(f, s)} tall onReveal={reveal(cellKey(f.key, s.id))} />
              ) : (
                <p className="text-[15px] leading-normal">{value(s, f.key)}</p>
              )}
            </section>
          );
        })}
      </div>

      {quiz ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <p>Overhoren: zeg of typ eerst wat je verwacht, open dan de cel. Onderscheidende kenmerken staan bovenaan.</p>
          {coverable.length > 0 ? (
            <button type="button" onClick={() => setShown(allShown ? new Set() : new Set(coverable))} className="min-h-8 font-bold text-accent">
              {allShown ? "Opnieuw afdekken" : "Alles tonen"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">Onderscheidende kenmerken staan bovenaan. Kies Overhoren om eerst zelf op te halen.</p>
      )}
    </>
  );
}
