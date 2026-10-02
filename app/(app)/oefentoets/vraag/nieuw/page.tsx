import type { Metadata } from "next";
import Link from "next/link";
import { Button, Field, PageHeader, Panel, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createQuestion } from "../../actions";
import { QuestionFields } from "../../question-form";

export const metadata: Metadata = { title: "Nieuwe vraag" };

export default async function NewQuestionPage() {
  const { supabase } = await requireUser();
  const { data: topics } = await supabase.from("topics").select("id, name, sort_order, modules(name, sort_order)").order("sort_order");
  const sorted = (topics ?? []).sort((a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order);
  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/oefentoets" className="underline">Oefentoets</Link>
      </p>
      <PageHeader title="Nieuwe vraag" />
      <Panel>
        <form action={createQuestion} className="space-y-4">
          <Field label="Thema">
            <Select name="topic_id" required>
              {sorted.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.modules?.name} · {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <QuestionFields />
          <p className="text-xs text-muted">Een zelf geschreven vraag is direct actief. Leerdoelen koppel je na het opslaan.</p>
          <Button variant="primary">Opslaan</Button>
        </form>
      </Panel>
    </>
  );
}
