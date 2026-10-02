import type { Metadata } from "next";
import Link from "next/link";
import { Button, Field, Notice, PageHeader, Panel, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createCase } from "../actions";
import { CaseFields } from "../case-form";

export const metadata: Metadata = { title: "Nieuwe casus" };

export default async function NewCasePage({ searchParams }: PageProps<"/casussen/nieuw">) {
  const { stage } = await searchParams;
  const internship = stage === "1";
  const { supabase } = await requireUser();
  const { data: topics } = await supabase.from("topics").select("id, name, sort_order, modules(name, sort_order)").order("sort_order");
  const options = (topics ?? []).sort(
    (a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order,
  );

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/casussen" className="underline">Casussen</Link>
      </p>
      <PageHeader title={internship ? "Nieuwe casus uit stage" : "Nieuwe casus"} />
      {internship ? (
        <div className="mb-4">
          <Notice tone="error">Schrijf geanonimiseerd: geen naam, geboortedatum of herkenbare details.</Notice>
        </div>
      ) : null}
      {options.length === 0 ? (
        <Panel className="text-sm text-muted">
          Maak eerst een thema aan via <Link className="underline" href="/themas">Thema&apos;s</Link>.
        </Panel>
      ) : (
        <Panel>
          <form action={createCase} className="space-y-4">
            <input type="hidden" name="from_internship" value={internship ? "1" : "0"} />
            <Field label="Thema">
              <Select name="topic_id" required>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.modules?.name} · {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <CaseFields />
            <p className="text-xs text-muted">
              {internship ? "Een stagecasus is direct actief." : "Een nieuwe casus begint als concept; keur hem daarna goed."}
            </p>
            <Button variant="primary">Opslaan</Button>
          </form>
        </Panel>
      )}
    </>
  );
}
