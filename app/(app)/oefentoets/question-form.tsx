import { Field, Select, Textarea } from "@/components/ui";

type QuestionValues = {
  kind: string;
  format: string;
  stem: string;
  options: string[] | null;
  correct_option: number | null;
  model_answer: string | null;
  explanation: string | null;
};

export function QuestionFields({ value }: { value?: QuestionValues }) {
  const options = value?.options ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Soort">
          <Select name="kind" defaultValue={value?.kind ?? "exam"}>
            <option value="pretest">Pretestvraag (vóór het thema)</option>
            <option value="exam">Toetsvraag (proeftoets)</option>
          </Select>
        </Field>
        <Field label="Vorm">
          <Select name="format" defaultValue={value?.format ?? "mcq"}>
            <option value="mcq">Meerkeuze</option>
            <option value="open">Open</option>
          </Select>
        </Field>
      </div>
      <Field label="Vraag">
        <Textarea name="stem" defaultValue={value?.stem} rows={4} required maxLength={2000} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Opties (alleen bij meerkeuze)</legend>
        <p className="text-xs text-muted">Minstens drie opties. Kies het juiste antwoord met het rondje.</p>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct_option"
              value={i}
              defaultChecked={value?.correct_option === i}
              aria-label={`Optie ${String.fromCharCode(65 + i)} is juist`}
              className="h-5 w-5 shrink-0"
            />
            <span className="w-5 text-sm font-semibold">{String.fromCharCode(65 + i)}</span>
            <input
              name={`option${i}`}
              defaultValue={options[i] ?? ""}
              aria-label={`Optie ${String.fromCharCode(65 + i)}`}
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </div>
        ))}
      </fieldset>
      <Field label="Modelantwoord" hint="Verplicht bij open vragen">
        <Textarea name="model_answer" defaultValue={value?.model_answer ?? ""} rows={3} />
      </Field>
      <Field label="Uitleg">
        <Textarea name="explanation" defaultValue={value?.explanation ?? ""} rows={2} />
      </Field>
    </div>
  );
}
