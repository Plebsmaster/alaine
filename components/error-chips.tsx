"use client";

import { ERROR_TYPES, type ErrorType } from "@/lib/labels";
import { Kbd } from "./ui";

const SIZES = {
  // Herhaalscherm: in de dock, zelfde knopstijl als de beoordelingen (ontwerp 1f).
  dock: "flex h-14 items-center gap-3 rounded-xl px-4 text-[15px] font-medium md:h-[60px]",
  md: "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm",
  sm: "inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs",
} as const;

/**
 * A1: fouttype na "Opnieuw" of "Moeilijk". Eén tik, overslaan mag. Een suggestie van de
 * AI staat voorgeselecteerd. Het fouttype verandert de FSRS-beoordeling niet.
 * Sneltoetsen (1–3, Enter) handelt de pagina af; de cijfers hier zijn alleen een hint.
 */
export function ErrorChips({
  suggested,
  onPick,
  skipLabel = "Overslaan",
  size = "md",
}: {
  suggested: ErrorType | null;
  onPick: (type: ErrorType | null) => void;
  skipLabel?: string;
  size?: keyof typeof SIZES;
}) {
  const keys = size !== "sm";
  const base = `${SIZES[size]} transition-colors motion-reduce:transition-none`;
  return (
    <div className="space-y-2" role="group" aria-label="Wat ging er mis?">
      <p className="text-sm font-bold">Wat ging er mis?</p>
      <div className={size === "dock" ? "grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5" : "flex flex-wrap gap-2"}>
        {ERROR_TYPES.map((t, i) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={suggested === t.value}
            onClick={() => onPick(t.value)}
            className={`${base} border border-border-strong bg-surface hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-bold aria-pressed:shadow-[inset_0_0_0_1px_var(--accent)]`}
          >
            {keys ? (
              <Kbd aria-hidden className="hidden md:inline-flex">
                {suggested === t.value ? "↵" : i + 1}
              </Kbd>
            ) : null}
            <span className="text-left">{t.label}</span>
          </button>
        ))}
        <button type="button" onClick={() => onPick(null)} className={`${base} text-muted hover:bg-surface-2`}>
          {keys && !suggested ? (
            <Kbd aria-hidden className="hidden md:inline-flex">
              ↵
            </Kbd>
          ) : null}
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
