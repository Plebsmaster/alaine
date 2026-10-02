import { Field, Input, Select, Textarea } from "./ui";

export const CARD_TYPE_OPTIONS = [
  { value: "fact", label: "Feit of definitie" },
  { value: "explain", label: "Uitleg (waarom, mechanisme)" },
  { value: "illness_script", label: "Illness script" },
  { value: "compare", label: "Vergelijken" },
  { value: "image", label: "Beeld" },
  { value: "skill", label: "Vaardigheid" },
  { value: "communication", label: "Communicatie" },
  { value: "chain", label: "Keten (mechanisme in stappen)" },
];

type Objective = { id: string; code: string | null; description: string };

export function CardFields({
  card,
  objectives,
  selected = [],
}: {
  card?: {
    type: string;
    front: string;
    back: string;
    explanation: string | null;
    source_locator: string | null;
    tags: string[];
    needs_verification?: boolean;
  };
  objectives: Objective[];
  selected?: string[];
}) {
  return (
    <div className="space-y-3">
      <Field label="Type">
        <Select name="type" defaultValue={card?.type ?? "fact"}>
          {CARD_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Voorkant (vraag)" hint="Dwing ophalen af: geen ja/nee-vraag, het antwoord staat niet in de vraag.">
        <Textarea name="front" defaultValue={card?.front} required maxLength={2000} />
      </Field>
      <Field label="Achterkant (kort antwoord)" hint="Bij een ketenkaart: de stappen gescheiden door → (bijv. ACE-remming → minder angiotensine II → minder aldosteron).">
        <Textarea name="back" defaultValue={card?.back} required maxLength={2000} />
      </Field>
      <Field label="Uitleg (optioneel)">
        <Textarea name="explanation" defaultValue={card?.explanation ?? ""} rows={2} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Bronvermelding" hint="Bijv. p. 412 of dia 23">
          <Input name="source_locator" defaultValue={card?.source_locator ?? ""} />
        </Field>
        <Field label="Tags" hint="Gescheiden door komma's">
          <Input name="tags" defaultValue={card?.tags.join(", ") ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needs_verification" defaultChecked={card?.needs_verification ?? false} className="h-4 w-4" />
        Te controleren (komt niet aantoonbaar uit de bron)
      </label>
      {objectives.length > 0 ? (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Leerdoelen</legend>
          {objectives.map((o) => (
            <label key={o.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="objectives" value={o.id} defaultChecked={selected.includes(o.id)} className="mt-1 h-4 w-4" />
              <span>
                {o.code ? <strong>{o.code} </strong> : null}
                {o.description}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
