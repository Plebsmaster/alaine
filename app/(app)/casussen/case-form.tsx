import { Field, Input, Select, Textarea } from "@/components/ui";
import type { ExpertReflection } from "@/lib/cases";

const ROWS = 5;

type CaseValues = {
  title: string;
  vignette: string;
  question: string;
  teaching_points: string | null;
  difficulty: number | null;
  expert_reflection: ExpertReflection[];
  needs_verification?: boolean;
};

/** Velden van een casus. Rij 1 van de differentiaal is de juiste diagnose. */
export function CaseFields({ value }: { value?: CaseValues }) {
  const rows = [...(value?.expert_reflection ?? [])].sort((a, b) => a.rank - b.rank);
  return (
    <div className="space-y-4">
      <Field label="Titel" hint="Kort, zonder de diagnose te verklappen">
        <Input name="title" defaultValue={value?.title} required />
      </Field>
      <Field label="Vignet" hint="Leeftijd, geslacht, hulpvraag, anamnese en bevindingen">
        <Textarea name="vignette" defaultValue={value?.vignette} rows={6} required maxLength={2000} />
      </Field>
      <Field label="Vraag">
        <Input name="question" defaultValue={value?.question ?? "Wat is je werkdiagnose?"} />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Expert-uitwerking</legend>
        <p className="text-xs text-muted">Rij 1 is de juiste diagnose. Geef minstens één gelijkend alternatief. Lege rijen worden overgeslagen.</p>
        {Array.from({ length: ROWS }, (_, i) => {
          const r = rows[i];
          return (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <Field label={i === 0 ? "1. Juiste diagnose" : `${i + 1}. Alternatief`}>
                <Input name={`d${i}_diagnosis`} defaultValue={r?.diagnosis} required={i < 2} />
              </Field>
              <div className="grid gap-2 md:grid-cols-3">
                <Field label="Past erbij">
                  <Textarea name={`d${i}_supporting`} defaultValue={r?.supporting ?? ""} rows={2} />
                </Field>
                <Field label="Spreekt tegen">
                  <Textarea name={`d${i}_against`} defaultValue={r?.against ?? ""} rows={2} />
                </Field>
                <Field label="Verwacht maar afwezig">
                  <Textarea name={`d${i}_missing`} defaultValue={r?.missing ?? ""} rows={2} />
                </Field>
              </div>
            </div>
          );
        })}
      </fieldset>

      <Field label="Lessen van deze casus" hint="De twee of drie belangrijkste lessen">
        <Textarea name="teaching_points" defaultValue={value?.teaching_points ?? ""} rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needs_verification" defaultChecked={value?.needs_verification ?? false} className="h-4 w-4" />
        Te controleren (komt niet aantoonbaar uit de bron)
      </label>
      <Field label="Moeilijkheid">
        <Select name="difficulty" defaultValue={String(value?.difficulty ?? 2)}>
          <option value="1">1 · makkelijk</option>
          <option value="2">2 · gemiddeld</option>
          <option value="3">3 · moeilijk</option>
        </Select>
      </Field>
    </div>
  );
}
