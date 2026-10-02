import type { Metadata } from "next";
import Link from "next/link";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { createScript } from "../actions";
import { AiScriptForm } from "./ai-form";

export const metadata: Metadata = { title: "Nieuw illness script" };

export default async function NewScriptPage() {
  const { supabase } = await requireUser();
  const [{ data: topics }, { data: sources }] = await Promise.all([
    supabase.from("topics").select("id, name, sort_order, modules(name, sort_order)").order("sort_order"),
    supabase.from("sources").select("id, title, author, chapter").order("title"),
  ]);
  const topicOptions = (topics ?? [])
    .sort((a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order)
    .map((t) => ({ id: t.id, label: `${t.modules?.name ?? ""} · ${t.name}` }));
  const sourceOptions = (sources ?? []).map((s) => ({
    id: s.id,
    label: [s.author, s.title, s.chapter ? `h. ${s.chapter}` : null].filter(Boolean).join(", "),
  }));

  if (topicOptions.length === 0) {
    return (
      <>
        <PageHeader title="Nieuw illness script" />
        <Panel className="text-sm text-muted">
          Maak eerst een thema aan via <Link className="underline" href="/themas">Thema&apos;s</Link>.
        </Panel>
      </>
    );
  }

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/scripts" className="underline">Illness scripts</Link>
      </p>
      <PageHeader title="Nieuw illness script" />
      <div className="space-y-6">
        <Panel>
          <h2 className="mb-3 font-semibold">Zelf schrijven</h2>
          <form action={createScript} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Thema">
              <Select name="topic_id" required>
                {topicOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Aandoening">
              <Input name="condition" required />
            </Field>
            <Button variant="primary">Aanmaken</Button>
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-1 font-semibold">Concept laten maken uit brontekst</h2>
          <p className="mb-3 text-sm text-muted">De AI vult alleen wat de bron onderbouwt. Je controleert en keurt het daarna zelf goed.</p>
          <AiScriptForm topics={topicOptions} sources={sourceOptions} enabled={aiConfigured()} />
        </Panel>
      </div>
    </>
  );
}
