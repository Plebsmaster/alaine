"use client";

import { type ReactNode, useActionState, useState } from "react";
import { Icon } from "@/components/nav";
import { Button, Field, Input, Notice } from "@/components/ui";
import { login, type LoginState } from "./actions";
import { OTP_LENGTH } from "./otp";

export function LoginForm({ notice }: { notice?: ReactNode }) {
  const [restart, setRestart] = useState(0);
  return <Form key={restart} notice={restart === 0 ? notice : null} onRestart={() => setRestart((n) => n + 1)} />;
}

function Steps({ current }: { current: 1 | 2 }) {
  const dot = "flex h-6 w-6 items-center justify-center rounded-full text-xs";
  return (
    <ol aria-label="Stappen" className="hidden items-center gap-2.5 text-[13px] font-bold md:flex">
      <li className="flex items-center gap-2.5" aria-current={current === 1 ? "step" : undefined}>
        {current === 1 ? (
          <span className={`${dot} bg-accent text-accent-text`}>1</span>
        ) : (
          <span className={`${dot} bg-accent-soft text-accent-strong`}>
            <Icon d="M4 12l5 5L20 6" size={13} strokeWidth={2.6} />
          </span>
        )}
        <span className={current === 1 ? "" : "text-accent-strong"}>E-mail</span>
      </li>
      <li aria-hidden className="h-px w-8 bg-border-strong" />
      <li className="flex items-center gap-2.5" aria-current={current === 2 ? "step" : undefined}>
        <span className={`${dot} ${current === 2 ? "bg-accent text-accent-text" : "border-[1.5px] border-border-strong text-muted"}`}>2</span>
        <span className={current === 2 ? "" : "text-muted"}>Code</span>
      </li>
    </ol>
  );
}

/**
 * Zes vakjes, gebouwd als één transparante input erboven (ontwerp 1d): plakken, iOS-autofill
 * ("one-time-code") en de PWA op het beginscherm blijven zo gewoon werken.
 */
function CodeInput() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, OTP_LENGTH - 1);
  return (
    <div className="relative mt-2">
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const on = focused && i === active;
          return (
            <div
              key={i}
              className={`flex h-[62px] items-center justify-center rounded-xl bg-surface text-[28px] font-medium tabular-nums ${
                on ? "border-2 border-accent" : "border-[1.5px] border-border-strong"
              }`}
            >
              {value[i] ?? (on ? <span className="h-7 w-0.5 animate-pulse bg-text motion-reduce:animate-none" /> : null)}
            </div>
          );
        })}
      </div>
      <input
        name="token"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        // Geen maxLength: die kapt "123 456" af vóór de spaties eruit zijn; onChange begrenst op zes cijfers.
        required
        autoFocus
        aria-label="Code uit de e-mail"
        // De focus is zichtbaar in het actieve vakje (rand en cursor); de globale focusring om het hele raster niet.
        style={{ outline: "none" }}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent selection:bg-transparent"
      />
    </div>
  );
}

function Form({ notice, onRestart }: { notice?: ReactNode; onRestart: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email", email: "" });

  if (state.step === "email") {
    return (
      <form action={action} className="flex min-h-dvh flex-col px-6 pt-10 md:min-h-0 md:w-[380px] md:p-0">
        <div className="flex flex-col gap-[26px]">
          {/* Telefoon: merk bovenaan; op laptop staat het in het linkerpaneel. */}
          <div className="flex items-center gap-2.5 md:hidden">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-accent text-xs font-bold text-accent-text">PA</span>
            <span className="text-base font-bold">PA Studie</span>
          </div>
          <Steps current={1} />
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[34px] font-medium leading-[1.1] md:text-4xl">Inloggen</h1>
            <p className="text-base leading-normal text-text-2">Je krijgt een inlogcode per e-mail.</p>
          </div>
          {notice}
          <Field label="E-mailadres">
            <Input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.email} autoFocus className="h-[50px]" />
          </Field>
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        </div>
        <div className="flex-1 md:hidden" />
        <div className="flex flex-col gap-3 pb-[34px] pt-6 md:pb-0">
          <Button variant="primary" className="h-[50px] w-full text-base" disabled={pending}>
            {pending ? "Bezig…" : "Stuur inlogcode"}
          </Button>
          <p className="text-sm leading-normal text-muted">Alleen het vastgelegde adres kan inloggen.</p>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex min-h-dvh flex-col px-6 pt-4 md:min-h-0 md:w-[380px] md:p-0">
      <input type="hidden" name="email" value={state.email} />
      <div className="flex flex-col gap-[22px] md:gap-[26px]">
        <Steps current={2} />
        <button type="button" onClick={onRestart} className="-ml-1 flex h-11 items-center gap-1 self-start text-[15px] font-medium text-accent">
          <Icon d="M15 6l-6 6 6 6" size={18} />
          E-mailadres
        </button>
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[34px] font-medium leading-[1.1]">Vul je code in</h1>
          <p className="text-base leading-normal text-text-2">
            We stuurden een code van zes cijfers naar <b className="font-bold text-text">{state.email}</b>.
          </p>
        </div>
        <CodeInput />
        {state.info ? <Notice tone="ok">{state.info}</Notice> : null}
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <p className="text-sm leading-normal text-muted">Werkt ook in de app op je beginscherm. Je kunt ook op de link in de mail tikken.</p>
      </div>
      <div className="flex-1 md:hidden" />
      <div className="flex flex-col gap-2 pb-[34px] pt-6 md:pb-0">
        <Button variant="primary" className="h-[54px] w-full text-[17px]" disabled={pending}>
          {pending ? "Bezig…" : "Inloggen"}
        </Button>
        <Button type="submit" name="resend" value="1" formNoValidate variant="ghost" className="h-12 w-full" disabled={pending}>
          Nieuwe code sturen
        </Button>
      </div>
    </form>
  );
}
