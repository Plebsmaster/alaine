"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { draftCompareAction, type FormState } from "../actions";

export function CompareCardForm({ ids, enabled }: { ids: string[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftCompareAction, {});
  return (
    <form action={action} className="space-y-2">
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <Button variant="primary" disabled={!enabled || pending}>
        {pending ? "AI maakt een kaart…" : "Maak vergelijkingskaart"}
      </Button>
      {!enabled ? <p className="text-xs text-muted">AI is nog niet ingesteld (ANTHROPIC_API_KEY ontbreekt).</p> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
    </form>
  );
}
