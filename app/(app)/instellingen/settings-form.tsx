"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { saveSettings, type SettingsState } from "./actions";

export function SettingsForm({
  settings,
  timezones,
}: {
  settings: { desired_retention: number; max_new_per_day: number; timezone: string };
  timezones: string[];
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [retention, setRetention] = useState(settings.desired_retention);

  return (
    <form action={action} className="space-y-4">
      <Field label={`Gewenste retentie: ${Math.round(retention * 100)}%`} hint="Kans dat je een kaart nog weet op het moment van herhalen. Standaard 90%.">
        <input
          type="range"
          name="desired_retention"
          min={0.8}
          max={0.97}
          step={0.01}
          value={retention}
          onChange={(e) => setRetention(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </Field>
      {retention > 0.9 ? (
        <Notice>Boven 90% stijgt de werklast snel: je herhaalt veel vaker voor een klein beetje meer onthouden.</Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nieuwe kaarten per dag" hint="Elke nieuwe kaart kost de komende weken nog meerdere herhalingen.">
          <Input name="max_new_per_day" type="number" min={0} max={200} defaultValue={settings.max_new_per_day} />
        </Field>
        <Field label="Tijdzone" hint="Bepaalt wanneer een nieuwe dag begint.">
          <Select name="timezone" defaultValue={settings.timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state.message ? <Notice tone={state.ok ? "ok" : "error"}>{state.message}</Notice> : null}
      <Button variant="primary" disabled={pending}>
        {pending ? "Bezig…" : "Opslaan"}
      </Button>
    </form>
  );
}
