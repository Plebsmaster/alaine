"use client";

import { useActionState } from "react";
import { Button, Field, Notice, Select } from "@/components/ui";
import { draftCasesAction, type FormState } from "./actions";

export function AiCasesForm({ topics, enabled }: { topics: { id: string; label: string }[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftCasesAction, {});
  return (
    <form action={action} className="space-y-3">
      {!enabled ? <Notice>AI is nog niet ingesteld (geen ANTHROPIC_API_KEY en geen AI_PROVIDER=claude-code).</Notice> : null}
      <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
        <Field label="Thema">
          <Select name="topic_id" required>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Aantal">
          <Select name="n" defaultValue="5">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted">De AI werkt vanuit de goedgekeurde illness scripts van het thema. Alles komt binnen als concept.</p>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button disabled={!enabled || pending}>{pending ? "AI maakt casussen… (kan een minuut duren)" : "Maak conceptcasussen"}</Button>
    </form>
  );
}
