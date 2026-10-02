"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/nav";

// Gedeelde onderdelen van proeftoets en pretest (ontwerp 1t): eigen kop, vraagoverzicht en
// een balk met Vorige/Volgende. Eén vraag per scherm, op telefoon en laptop.

/** Kop met Stoppen, titel en een actie rechts. Met `data-own-header` verdwijnt de standaard focusbalk. */
export function RunnerHeader({ title, subtitle, action, width = "max-w-[720px]" }: { title: string; subtitle?: string; action?: ReactNode; width?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className={`mx-auto flex h-14 items-center gap-2 px-2 md:h-16 md:px-4 ${width}`}>
        <Link
          href="/oefentoets"
          aria-label="Stoppen"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none md:h-10 md:w-auto md:border md:border-border md:px-3"
        >
          <Icon d="M6 6l12 12M18 6L6 18" size={16} />
          <span className="hidden md:inline">Stoppen</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold md:ml-2">
          {title}
          {subtitle ? <span className="ml-2 font-normal text-muted">{subtitle}</span> : null}
        </h1>
        {action}
      </div>
    </header>
  );
}

/** Vraagoverzicht: tikken springt naar de vraag. */
export function QuestionNav({ done, current, onPick, doneLabel }: { done: boolean[]; current: number; onPick: (i: number) => void; doneLabel: string }) {
  return (
    <nav aria-label="Vraagoverzicht" className="grid grid-cols-10 gap-[5px]">
      {done.map((d, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-current={i === current ? "step" : undefined}
          aria-label={`Vraag ${i + 1}, ${d ? doneLabel : "open"}`}
          className={`flex h-6 items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors motion-reduce:transition-none md:h-7 md:text-xs ${
            i === current
              ? "border-2 border-accent bg-accent-soft text-accent-strong"
              : d
                ? "bg-accent text-accent-text hover:opacity-90"
                : "border border-border-strong bg-surface text-text-2 hover:bg-surface-2"
          }`}
        >
          {i + 1}
        </button>
      ))}
    </nav>
  );
}

/** Onderbalk: op de telefoon vast onderin, op laptop onder de vraag. */
export function RunnerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 grid grid-cols-[1fr_1.6fr] gap-2 border-t border-border bg-bg px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
      {children}
    </div>
  );
}

export const FOOTER_BUTTON = "h-[54px] text-base md:h-12 md:text-[15px]";

export const letter = (i: number) => String.fromCharCode(65 + i);
