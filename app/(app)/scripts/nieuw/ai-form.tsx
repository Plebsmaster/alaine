"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { draftScriptAction, type FormState } from "../actions";

type Option = { id: string; label: string };

export function AiScriptForm({ topics, sources, enabled }: { topics: Option[]; sources: Option[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftScriptAction, {});
  return (
    <form action={action} className="space-y-3">
      {!enabled ? <Notice>AI is nog niet ingesteld (ANTHROPIC_API_KEY ontbreekt). Maak het script hierboven met de hand.</Notice> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Thema">
          <Select name="topic_id" required>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Aandoening">
          <Input name="condition" required placeholder="Bijv. Boezemfibrilleren" />
        </Field>
        <Field label="Bron">
          <Select name="source_id" defaultValue="">
            <option value="">Geen</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pagina's" hint="Bijv. p. 712-715">
          <Input name="source_locator" />
        </Field>
      </div>
      <Field label="Brontekst" hint="Plak de relevante paragrafen. De AI gebruikt alleen deze tekst.">
        <Textarea name="source_text" rows={10} required />
      </Field>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button variant="primary" disabled={!enabled || pending}>
        {pending ? "AI maakt een concept… (kan een halve minuut duren)" : "Maak concept met AI"}
      </Button>
    </form>
  );
}
