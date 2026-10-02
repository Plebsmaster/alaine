"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [restart, setRestart] = useState(0);
  return <Form key={restart} onRestart={() => setRestart((n) => n + 1)} />;
}

function Form({ onRestart }: { onRestart: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email", email: "" });

  if (state.step === "email") {
    return (
      <form action={action} className="space-y-4">
        <Field label="E-mailadres">
          <Input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.email} autoFocus />
        </Field>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <Button variant="primary" className="w-full" disabled={pending}>
          {pending ? "Bezig…" : "Stuur inlogcode"}
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.info ? <Notice tone="ok">{state.info}</Notice> : null}
      <input type="hidden" name="email" value={state.email} />
      <Field label="Code uit de e-mail" hint="Werkt ook in de app op je beginscherm. Je kunt ook op de link in de mail tikken.">
        <Input
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          className="text-center text-2xl tracking-[0.3em]"
        />
      </Field>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button variant="primary" className="w-full" disabled={pending}>
        {pending ? "Bezig…" : "Inloggen"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onRestart}>
        Ander e-mailadres of nieuwe code
      </Button>
    </form>
  );
}
