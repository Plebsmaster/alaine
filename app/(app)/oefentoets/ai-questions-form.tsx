"use client";

import { useActionState } from "react";
import { Button, Field, Notice, Select, Textarea } from "@/components/ui";
import { draftQuestionsAction, type FormState } from "./actions";

export function AiQuestionsForm({ topics, enabled }: { topics: { id: string; label: string }[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftQuestionsAction, {});
  return (
    <form action={action} className="space-y-3">
      {!enabled ? <Notice>AI is nog niet ingesteld (ANTHROPIC_API_KEY ontbreekt).</Notice> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Thema">
          <Select name="topic_id" required>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Soort">
          <Select name="kind" defaultValue="exam">
            <option value="pretest">Pretest</option>
            <option value="exam">Toetsvragen</option>
          </Select>
        </Field>
        <Field label="Vorm">
          <Select name="format" defaultValue="mixed">
            <option value="mixed">Gemengd</option>
            <option value="mcq">Meerkeuze</option>
            <option value="open">Open</option>
          </Select>
        </Field>
        <Field label="Aantal">
          <Select name="n" defaultValue="10">
            {[5, 8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Brontekst (optioneel)" hint="Zonder brontekst gebruikt de AI de goedgekeurde illness scripts van het thema.">
        <Textarea name="source_text" rows={5} />
      </Field>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button disabled={!enabled || pending}>{pending ? "AI maakt vragen…" : "Maak conceptvragen"}</Button>
    </form>
  );
}
