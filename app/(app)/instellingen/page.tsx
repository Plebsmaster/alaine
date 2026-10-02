import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { ImportPanel } from "./import-panel";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const settings = await getSettings(supabase);
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(settings.timezone)) timezones.unshift(settings.timezone);

  return (
    <>
      <PageHeader title="Instellingen" />
      <div className="space-y-6">
        <Panel>
          <h2 className="mb-3 font-semibold">Herhalen</h2>
          <SettingsForm settings={settings} timezones={timezones} />
        </Panel>

        <Panel>
          <h2 className="mb-1 font-semibold">Studiestof importeren</h2>
          <p className="mb-3 text-sm text-muted">
            Kies een JSON-bestand volgens het importformaat. Je ziet eerst wat er gebeurt; pas daarna importeer je. Kaarten, scripts,
            casussen en vragen komen binnen als concept.
          </p>
          <ImportPanel />
        </Panel>

        <Panel>
          <h2 className="mb-1 font-semibold">Exporteren</h2>
          <p className="mb-3 text-sm text-muted">Alle eigen gegevens als één JSON-bestand, inclusief het herhaallogboek.</p>
          <a href="/api/export" download className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
            Download export
          </a>
        </Panel>

        <p className="text-xs text-muted">Ingelogd als {user.email}</p>
      </div>
    </>
  );
}
