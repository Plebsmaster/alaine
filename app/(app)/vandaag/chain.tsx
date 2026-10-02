"use client";

import { useRef } from "react";
import { Button, Textarea } from "@/components/ui";

/** Ketenstappen uit tekst: gescheiden door → (of ->). */
export function chainSteps(text: string): string[] {
  return text
    .split(/\s*(?:→|->)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tekstveld voor een ketenantwoord met een knop die → invoegt op de cursor. */
export function ChainInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insertArrow = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start).trimEnd()} → ${value.slice(end).trimStart()}`;
    onChange(next);
    requestAnimationFrame(() => {
      const pos = next.length - value.slice(end).trimStart().length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };
  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        aria-label="Typ de keten (optioneel)"
        placeholder="Typ de keten, stap voor stap (optioneel)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
      <Button type="button" onClick={insertArrow} aria-label="Pijl invoegen">
        → invoegen
      </Button>
    </div>
  );
}

/** Na het tonen: de stappen van de student en de juiste keten naast elkaar. */
export function ChainCompare({ answer, back }: { answer: string; back: string }) {
  const mine = chainSteps(answer);
  const correct = chainSteps(back);
  const rows = Math.max(mine.length, correct.length);
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="w-8 py-1 text-left font-medium">#</th>
            <th className="py-1 text-left font-medium">Jouw keten</th>
            <th className="py-1 text-left font-medium">Juiste keten</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="py-1 tabular-nums text-muted">{i + 1}</td>
              <td className="py-1 pr-2">{mine[i] ?? <span className="text-muted">–</span>}</td>
              <td className="py-1">{correct[i] ?? <span className="text-muted">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
