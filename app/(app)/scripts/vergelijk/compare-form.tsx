"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { draftCompareAction, type FormState } from "../actions";

export function CompareCardForm({ ids, enabled }: { ids: string[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftCompareAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5 md:max-w-[260px] md:items-end">
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <Button disabled={!enabled || pending} className="text-[13px]">
        {pending ? "AI maakt een kaart…" : "Vergelijkingskaart (AI)"}
      </Button>
      {!enabled ? <p className="text-xs text-muted md:text-right">AI is nog niet ingesteld (ANTHROPIC_API_KEY ontbreekt).</p> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
    </form>
  );
}
