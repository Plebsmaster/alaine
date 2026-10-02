"use client";

import { ERROR_TYPES, type ErrorType } from "@/lib/labels";

/**
 * A1: fouttype na "Opnieuw" of "Moeilijk". Eén tik, overslaan mag. Een suggestie van de
 * AI staat voorgeselecteerd. Het fouttype verandert de FSRS-beoordeling niet.
 */
export function ErrorChips({
  suggested,
  onPick,
  skipLabel = "Overslaan",
}: {
  suggested: ErrorType | null;
  onPick: (type: ErrorType | null) => void;
  skipLabel?: string;
}) {
  return (
    <div className="space-y-2" role="group" aria-label="Wat ging er mis?">
      <p className="text-sm font-medium">Wat ging er mis?</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ERROR_TYPES.map((t, i) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={suggested === t.value}
            onClick={() => onPick(t.value)}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-surface-2 aria-pressed:font-semibold"
          >
            {t.label}
            <span className="hidden text-xs text-muted md:inline"> · {i + 1}</span>
          </button>
        ))}
        <button type="button" onClick={() => onPick(null)} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:bg-surface-2">
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
