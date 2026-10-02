"use client";

import { useState } from "react";
import { niceMax } from "@/lib/dashboard";

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
  compact = false,
}: {
  title: string;
  columns: Column[];
  /** Eenheid in enkelvoud en meervoud, bijv. ["herhaling", "herhalingen"]. */
  unit: [string, string];
  emptyText?: string;
  /** Lage variant (staafgebied 70 px) voor een zijpaneel. */
  compact?: boolean;
}) {
  const fmt = (n: number) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...columns.map((c) => c.value));
  const top = niceMax(max);
  // Label bij het hoogste punt, behalve als de as-bovengrens al hetzelfde getal toont.
  const peak = max > 0 && max !== top ? columns.findIndex((c) => c.value === max) : -1;

  return (
    <figure className="space-y-2">
      <figcaption className="text-[15px] font-bold">{title}</figcaption>
      {max === 0 && emptyText ? <p className="text-sm text-muted">{emptyText}</p> : null}
      {/* Asmaximum in een eigen kolom links, zodat het nooit over het piek-label valt. */}
      <div className="relative ml-[26px]">
        <div className="pointer-events-none absolute -left-[26px] top-4 text-[11px] leading-none tabular-nums text-muted">{top}</div>
        <div
          className={`flex items-end gap-[2px] border-b border-border pt-4 ${compact ? "h-[86px]" : "h-48"}`}
          onPointerLeave={() => setActive(null)}
        >
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
                  <span className="absolute text-[11px] tabular-nums text-muted" style={{ bottom: `calc(${h}% + 2px)` }}>
                    {c.value}
                  </span>
                ) : null}
                <span
                  className={`block w-full max-w-5 rounded-t-[4px] bg-chart transition-opacity ${active !== null && active !== i ? "opacity-60" : ""}`}
                  style={{ height: c.value ? `max(${h}%, 2px)` : 0 }}
                />
              </button>
            );
          })}
        </div>
        {active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-xs"
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
