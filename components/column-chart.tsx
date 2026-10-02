"use client";

import { useState } from "react";

export type Column = { key: string; label: string; detail: string; value: number };

/**
 * Kolomdiagram voor één reeks (dus geen legenda; de titel zegt wat er staat).
 * Dunne kolommen (max. 24px, 4px afgerond aan de top), haarlijn-basislijn, tooltip
 * bij aanwijzen én toetsenbordfocus, een label bij het hoogste punt, en een
 * tabelweergave zodat geen waarde alleen via de tooltip te zien is.
 */
export function ColumnChart({
  title,
  columns,
  unit,
  emptyText,
}: {
  title: string;
  columns: Column[];
  /** Eenheid in enkelvoud en meervoud, bijv. ["herhaling", "herhalingen"]. */
  unit: [string, string];
  emptyText?: string;
}) {
  const fmt = (n: number) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...columns.map((c) => c.value));
  const top = niceMax(max);
  // Label bij het hoogste punt, behalve als de as-bovengrens al hetzelfde getal toont.
  const peak = max > 0 && max !== top ? columns.findIndex((c) => c.value === max) : -1;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      {max === 0 && emptyText ? <p className="text-sm text-muted">{emptyText}</p> : null}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-11 text-xs tabular-nums text-muted">{top}</div>
        <div className="flex h-52 items-end gap-[2px] border-b border-border pt-16" onPointerLeave={() => setActive(null)}>
          {columns.map((c, i) => {
            const h = top ? (c.value / top) * 100 : 0;
            return (
              <button
                key={c.key}
                type="button"
                aria-label={`${c.detail}: ${fmt(c.value)}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center focus-visible:outline-offset-0"
              >
                {i === peak ? (
                  <span className="absolute text-xs tabular-nums text-muted" style={{ bottom: `calc(${h}% + 2px)` }}>
                    {c.value}
                  </span>
                ) : null}
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity ${active !== null && active !== i ? "opacity-60" : ""}`}
                  style={{ height: c.value ? `max(${h}%, 2px)` : 0 }}
                />
              </button>
            );
          })}
        </div>
        {active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow-sm"
            style={{ left: `clamp(3.5rem, ${((active + 0.5) / columns.length) * 100}%, calc(100% - 3.5rem))` }}
          >
            <strong className="block text-sm tabular-nums">{fmt(columns[active].value)}</strong>
            <span className="text-muted">{columns[active].detail}</span>
          </div>
        ) : null}
        <div className="mt-1 flex gap-[2px] text-[0.65rem] text-muted" aria-hidden>
          {columns.map((c, i) => (
            <span key={c.key} className="flex-1 text-center tabular-nums">
              {i % 2 === 0 || columns.length <= 7 ? c.label : ""}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Als tabel</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {columns.map((c) => (
              <tr key={c.key} className="border-t border-border">
                <td className="py-1">{c.detail}</td>
                <td className="py-1 text-right tabular-nums">{fmt(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Ronde bovengrens voor de as: 0, 5, 10, 20, 50, 100, … */
function niceMax(n: number): number {
  if (n <= 0) return 0;
  const steps = [1, 2, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(n));
  for (const s of steps) if (s * mag >= n) return s * mag;
  return 10 * mag;
}
