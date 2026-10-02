import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Field, Input, Notice, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { deleteScript, saveScript, setScriptStatus } from "../actions";
import { SCRIPT_FIELDS, SCRIPT_STATUS_LABELS } from "../script-labels";

export const metadata: Metadata = { title: "Illness script" };

const CARD_STATUS: Record<string, string> = { active: "actief", draft: "concept", suspended: "geschorst" };

export default async function ScriptPage({ params, searchParams }: PageProps<"/scripts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const { data: script } = await supabase
    .from("illness_scripts")
    .select("*, topics(id, name), cards(id, front, status, script_field)")
    .eq("id", id)
    .maybeSingle();
  if (!script) notFound();

  const [{ data: sources }, { data: related }] = await Promise.all([
    supabase.from("sources").select("id, title, author, chapter").order("title"),
    // Weinig scripts per gebruiker: alles ophalen en hier filteren is eenvoudiger dan een or-filter op vrije tekst.
    supabase.from("illness_scripts").select("id, condition, topic_id").neq("id", id).eq("status", "active").order("condition"),
  ]);

  const similarLower = new Set(script.similar_conditions.map((c) => c.toLowerCase()));
  const similarScripts = (related ?? []).filter((r) => similarLower.has(r.condition.toLowerCase()));
  const sameTopic = (related ?? []).filter(
    (r) => r.topic_id === script.topic_id && !similarLower.has(r.condition.toLowerCase()),
  );
  const newCards = typeof sp.kaarten === "string" ? Number(sp.kaarten) : null;

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/scripts" className="underline">Illness scripts</Link> ·{" "}
        <Link href={`/thema/${script.topics?.id}`} className="underline">{script.topics?.name}</Link>
      </p>
      <PageHeader title={script.condition}>
        <div className="flex gap-2">
          <Badge>{SCRIPT_STATUS_LABELS[script.status]}</Badge>
          {script.origin === "ai" ? <Badge>AI-concept</Badge> : null}
        </div>
      </PageHeader>

      <div className="mb-4 space-y-2">
        {newCards !== null ? (
          <Notice tone="ok">
            Goedgekeurd. {newCards === 0 ? "Er kwamen geen nieuwe kaarten bij." : `${newCards} scriptkaart(en) staan als concept klaar in `}
            {newCards > 0 ? <Link className="underline" href={`/goedkeuren?thema=${script.topic_id}`}>Goedkeuren</Link> : null}
          </Notice>
        ) : null}
        {sp.opgeslagen ? <Notice tone="ok">Opgeslagen.</Notice> : null}
        {sp.ai ? <Notice>Dit is een AI-concept. Controleer elk veld tegen de bron en zet het in je eigen woorden.</Notice> : null}
      </div>

      <Panel className="mb-6">
        <form action={saveScript} className="space-y-4">
          <input type="hidden" name="id" value={script.id} />
          <Field label="Aandoening">
            <Input name="condition" defaultValue={script.condition} required />
          </Field>
          {SCRIPT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Textarea name={f.key} defaultValue={script[f.key] ?? ""} rows={3} />
            </Field>
          ))}
          <Field label="Gelijkende aandoeningen" hint="Gescheiden door komma's">
            <Input name="similar_conditions" defaultValue={script.similar_conditions.join(", ")} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Bron">
              <Select name="source_id" defaultValue={script.source_id ?? ""}>
                <option value="">Geen</option>
                {(sources ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.author, s.title, s.chapter ? `h. ${s.chapter}` : null].filter(Boolean).join(", ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pagina's">
              <Input name="source_locator" defaultValue={script.source_locator ?? ""} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needs_verification" defaultChecked={script.needs_verification} className="h-4 w-4" />
            Te controleren (komt niet aantoonbaar uit de bron)
          </label>
          <p className="text-xs text-muted">
            Bij goedkeuren komt er per gevuld veld (presentatie, pathofysiologie, bevindingen, beleid) één conceptkaart bij.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" name="intent" value="approve">
              {script.status === "active" ? "Opslaan en kaarten bijwerken" : "Opslaan en goedkeuren"}
            </Button>
            <Button name="intent" value="save">Alleen opslaan</Button>
          </div>
        </form>
      </Panel>

      {script.cards.length > 0 ? (
        <section className="mb-6 space-y-2">
          <h2 className="text-lg font-semibold">Kaarten uit dit script</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {script.cards.map((c) => (
              <li key={c.id}>
                <Link href={`/kaart/${c.id}?terug=/scripts/${id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                  <span className="text-sm">{c.front}</span>
                  <Badge>{CARD_STATUS[c.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {script.status === "active" && (similarScripts.length > 0 || sameTopic.length > 0) ? (
        <section className="mb-6 space-y-2">
          <h2 className="text-lg font-semibold">Vergelijken met</h2>
          <ul className="flex flex-wrap gap-2">
            {[...similarScripts, ...sameTopic].map((r) => (
              <li key={r.id}>
                <Link href={`/scripts/vergelijk?id=${id}&id=${r.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-2">
                  {r.condition}
                  {similarLower.has(r.condition.toLowerCase()) ? <span className="ml-2 text-xs text-muted">gelijkend</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {script.status !== "archived" ? (
          <form action={setScriptStatus}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="archived" />
            <Button>Archiveren</Button>
          </form>
        ) : (
          <form action={setScriptStatus}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="draft" />
            <Button>Terug naar concept</Button>
          </form>
        )}
        <form action={deleteScript}>
          <input type="hidden" name="id" value={id} />
          <ConfirmButton variant="danger" message="Script verwijderen? De kaarten die eruit zijn gemaakt, en hun herhalingen, verdwijnen ook.">
            Verwijderen
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
