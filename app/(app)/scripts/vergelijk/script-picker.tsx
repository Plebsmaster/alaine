"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Option = { id: string; condition: string; topic: string | null; href: string };

/** "+ Aandoening": kiezer in een popover; elke keuze is een link met het extra id in de URL. */
export function ScriptPicker({ options }: { options: Option[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.condition.toLowerCase().includes(q) || o.topic?.toLowerCase().includes(q)) : options;

  return (
    <>
      <button
        type="button"
        popoverTarget="script-kiezer"
        className="min-h-9 rounded-full border border-dashed border-border-dashed px-3 text-[13px] text-text-2 transition-colors hover:bg-surface motion-reduce:transition-none"
      >
        + Aandoening
      </button>
      <div
        ref={ref}
        id="script-kiezer"
        popover="auto"
        aria-label="Aandoening toevoegen"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-border bg-surface p-0 text-text shadow-[0_20px_50px_rgb(40_40_30/.18)] backdrop:bg-text/30"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2">
          <h2 className="text-[15px] font-bold">Aandoening toevoegen</h2>
          <button type="button" popoverTarget="script-kiezer" popoverTargetAction="hide" className="min-h-11 px-2 text-sm font-bold text-accent">
            Sluiten
          </button>
        </div>
        {options.length > 8 ? (
          <div className="px-5 pt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Zoek een aandoening"
              placeholder="Zoek een aandoening"
              className="min-h-11 w-full rounded-[10px] border border-border-strong bg-surface px-3.5 text-base placeholder:text-muted focus:border-accent"
            />
          </div>
        ) : null}
        <ul className="max-h-[60dvh] overflow-y-auto py-2">
          {shown.map((o) => (
            <li key={o.id}>
              <Link
                href={o.href}
                onClick={() => ref.current?.hidePopover()}
                className="flex min-h-11 items-center justify-between gap-3 px-5 py-2 text-[15px] hover:bg-surface-2"
              >
                <span>{o.condition}</span>
                {o.topic ? <span className="shrink-0 text-xs text-muted">{o.topic}</span> : null}
              </Link>
            </li>
          ))}
          {shown.length === 0 ? <li className="px-5 py-3 text-sm text-muted">Geen aandoening gevonden.</li> : null}
        </ul>
      </div>
    </>
  );
}
