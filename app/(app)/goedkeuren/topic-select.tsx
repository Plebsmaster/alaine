"use client";

import { useRouter } from "next/navigation";

/** Themakeuze in de lijstkop van Goedkeuren; wisselt via de URL (?thema=). */
export function TopicSelect({ options, value, base }: { options: { id: string; name: string }[]; value: string | null; base: Record<string, string> }) {
  const router = useRouter();
  return (
    <select
      aria-label="Thema"
      value={value ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(base);
        if (e.target.value) params.set("thema", e.target.value);
        const query = params.toString();
        router.push(query ? `/goedkeuren?${query}` : "/goedkeuren");
      }}
      className="h-8 min-w-0 max-w-[200px] truncate rounded-lg border border-border-strong bg-surface px-2 text-[13px] text-text"
    >
      <option value="">Alle thema&apos;s</option>
      {options.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
