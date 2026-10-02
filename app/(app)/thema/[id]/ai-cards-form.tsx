"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { draftCardsAction, type DraftCardsState } from "./actions";

const TYPES = [
  { value: "fact", label: "Feit of definitie" },
  { value: "explain", label: "Uitleg (waarom)" },
  { value: "chain", label: "Keten (mechanisme in stappen)" },
  { value: "skill", label: "Vaardigheid (stappen)" },
  { value: "communication", label: "Communicatie" },
];

export function AiCardsForm({
  topicId,
  sources,
  enabled,
  hasObjectives,
}: {
  topicId: string;
  sources: { id: string; label: string }[];
  enabled: boolean;
  hasObjectives: boolean;
}) {
  const [state, action, pending] = useActionState<DraftCardsState, FormData>(draftCardsAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="topic_id" value={topicId} />
      {!enabled ? <Notice>AI is nog niet ingesteld (ANTHROPIC_API_KEY ontbreekt).</Notice> : null}
      {!hasObjectives ? <Notice>Voeg eerst leerdoelen toe: de AI koppelt elke kaart aan een leerdoel.</Notice> : null}
      <Field label="Brontekst" hint="Plak een paragraaf of hoofdstukdeel. De AI gebruikt alleen deze tekst.">
        <Textarea name="source_text" rows={8} required />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
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
        <Field label="Pagina's" hint="Als de tekst ze zelf niet noemt">
          <Input name="source_locator" />
        </Field>
        <Field label="Maximaal aantal kaarten">
          <Input name="max" type="number" min={1} max={30} defaultValue={15} />
        </Field>
      </div>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="mb-1 text-sm font-medium">Kaarttypes</legend>
        {TYPES.map((t) => (
          <label key={t.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="types" value={t.value} defaultChecked={t.value === "fact" || t.value === "explain" || t.value === "chain"} className="h-4 w-4" />
            {t.label}
          </label>
        ))}
      </fieldset>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button variant="primary" disabled={!enabled || !hasObjectives || pending}>
        {pending ? "AI maakt kaarten… (kan een halve minuut duren)" : "Maak conceptkaarten"}
      </Button>
      <p className="text-xs text-muted">De kaarten komen als concept op Goedkeuren. Pas na goedkeuren gaan ze de herhaling in.</p>
    </form>
  );
}
