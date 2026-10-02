import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { daysUntil } from "@/lib/time";
import { createModule, createTopic, deleteModule, updateModule } from "./actions";

export const metadata: Metadata = { title: "Thema's" };

export default async function TopicsPage() {
  const { supabase } = await requireUser();
  const [settings, { data: modules, error }, { data: counts }] = await Promise.all([
    getSettings(supabase),
    supabase
      .from("modules")
      .select("id, name, study_year, sort_order, exam_date, topics(id, name, sort_order)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "topics" }),
    supabase.from("topic_card_counts").select("*"),
  ]);
  if (error) throw new Error(error.message);
  const byTopic = new Map((counts ?? []).map((c) => [c.topic_id, c]));
  const now = new Date();

  return (
    <>
      <PageHeader title="Modules en thema's" />

      {(modules ?? []).length === 0 ? (
        <Panel className="mb-6 text-sm text-muted">
          Nog geen modules. Importeer studiestof via <Link className="underline" href="/instellingen">Instellingen</Link> of maak hieronder een module aan.
        </Panel>
      ) : null}

      <div className="space-y-6">
        {(modules ?? []).map((m) => {
          const days = m.exam_date ? daysUntil(m.exam_date, now, settings.timezone) : null;
          return (
            <Panel key={m.id} className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{m.name}</h2>
                {days !== null ? (
                  <span className="text-sm text-muted">
                    Toets {days >= 0 ? `over ${days} ${days === 1 ? "dag" : "dagen"}` : "geweest"}
                  </span>
                ) : null}
              </div>

              <ul className="divide-y divide-border rounded-lg border border-border">
                {m.topics.length === 0 ? <li className="px-3 py-2 text-sm text-muted">Nog geen thema&apos;s</li> : null}
                {m.topics.map((t) => {
                  const c = byTopic.get(t.id);
                  return (
                    <li key={t.id}>
                      <Link href={`/thema/${t.id}`} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 hover:bg-surface-2">
                        <span>{t.name}</span>
                        <span className="text-xs text-muted">
                          {c?.active ?? 0} actief · {c?.draft ?? 0} concept
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Module bewerken of thema toevoegen</summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <form action={updateModule} className="space-y-3">
                    <input type="hidden" name="id" value={m.id} />
                    <Field label="Naam">
                      <Input name="name" defaultValue={m.name} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Toetsdatum">
                        <Input name="exam_date" type="date" defaultValue={m.exam_date ?? ""} />
                      </Field>
                      <Field label="Volgorde">
                        <Input name="sort_order" type="number" defaultValue={m.sort_order} />
                      </Field>
                    </div>
                    <div className="flex gap-2">
                      <Button>Opslaan</Button>
                    </div>
                  </form>
                  <form action={createTopic} className="space-y-3">
                    <input type="hidden" name="module_id" value={m.id} />
                    <Field label="Nieuw thema">
                      <Input name="name" placeholder="Bijv. Ritmestoornissen" required />
                    </Field>
                    <Field label="Volgorde">
                      <Input name="sort_order" type="number" defaultValue={m.topics.length + 1} />
                    </Field>
                    <Button>Thema toevoegen</Button>
                  </form>
                </div>
                <form action={deleteModule} className="mt-4">
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton variant="danger" message={`Module "${m.name}" met alle thema's, kaarten en herhalingen verwijderen?`}>
                    Module verwijderen
                  </ConfirmButton>
                </form>
              </details>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-8">
        <h2 className="mb-3 font-semibold">Nieuwe module</h2>
        <form action={createModule} className="grid gap-3 md:grid-cols-2">
          <Field label="Naam">
            <Input name="name" placeholder="Bijv. PA de eerste stap" required />
          </Field>
          <Field label="Toetsdatum">
            <Input name="exam_date" type="date" />
          </Field>
          <Field label="Studiejaar">
            <Select name="study_year" defaultValue="1">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </Select>
          </Field>
          <Field label="Volgorde">
            <Input name="sort_order" type="number" defaultValue={(modules?.length ?? 0) + 1} />
          </Field>
          <div className="md:col-span-2">
            <Button variant="primary">Module toevoegen</Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
