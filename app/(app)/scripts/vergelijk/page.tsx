import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Segmented } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { compareHref, MAX_COMPARE, parseCompareIds, parseCompareMode } from "@/lib/compare";
import { CompareCardForm } from "./compare-form";
import { CompareView, type CompareScript } from "./compare-view";
import { ScriptPicker } from "./script-picker";

export const metadata: Metadata = { title: "Scripts vergelijken" };

// Illness scripts vergelijken (docs/design/README.md, 1p). Welke scripts en welke modus staan
// in de URL (?id=…&modus=overhoren); afgedekte cellen zijn alleen clientstate.
export default async function ComparePage({ searchParams }: PageProps<"/scripts/vergelijk">) {
  const { id, modus } = await searchParams;
  const ids = parseCompareIds(id);
  const mode = parseCompareMode(modus);
  const { supabase } = await requireUser();

  const { data } = ids.length
    ? await supabase
        .from("illness_scripts")
        .select("id, condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators")
        .in("id", ids)
    : { data: [] };
  const { data: active } = await supabase.from("illness_scripts").select("id, condition, topics(name)").eq("status", "active").order("condition");

  const scripts: CompareScript[] = ids
    .map((i) => (data ?? []).find((s) => s.id === i))
    .filter((s) => !!s)
    .map((s) => ({
      id: s.id,
      condition: s.condition,
      values: {
        epidemiology: s.epidemiology,
        pathophysiology: s.pathophysiology,
        presentation: s.presentation,
        findings: s.findings,
        management: s.management,
        key_discriminators: s.key_discriminators,
      },
    }));
  const current = scripts.map((s) => s.id);
  const addable = (active ?? [])
    .filter((s) => !current.includes(s.id))
    .map((s) => ({ id: s.id, condition: s.condition, topic: s.topics?.name ?? null, href: compareHref([...current, s.id], mode) }));
  const ready = scripts.length >= 2;

  const modeSwitch = (
    <Segmented
      size="sm"
      label="Weergave"
      value={mode}
      items={[
        { key: "lezen", label: "Lezen", href: compareHref(current, "lezen") },
        { key: "overhoren", label: "Overhoren", href: compareHref(current, "overhoren") },
      ]}
    />
  );

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
        <Link href="/scripts" className="flex min-h-11 items-center text-[13px] text-accent">
          ‹ Illness scripts
        </Link>
        {ready ? modeSwitch : null}
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2.5 w-full font-serif text-[28px] font-medium leading-tight md:w-auto md:text-[30px]">Vergelijken</h1>
          {scripts.map((s) => (
            <span key={s.id} className="flex items-center gap-0.5 rounded-full border border-border-strong bg-surface py-0.5 pl-3 pr-1 text-[13px]">
              {s.condition}
              <Link
                href={compareHref(
                  current.filter((x) => x !== s.id),
                  mode,
                )}
                aria-label={`${s.condition} uit de vergelijking halen`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
              >
                <span aria-hidden>×</span>
              </Link>
            </span>
          ))}
          {current.length < MAX_COMPARE && addable.length > 0 ? <ScriptPicker options={addable} /> : null}
        </div>
        {ready ? (
          <div className="hidden shrink-0 items-start gap-2.5 md:flex">
            {modeSwitch}
            <CompareCardForm ids={current} enabled={aiConfigured()} />
          </div>
        ) : null}
      </div>

      {ready ? (
        <>
          <CompareView key={`${current.join(",")}-${mode}`} scripts={scripts} mode={mode} />
          <div className="mt-6 md:hidden">
            <CompareCardForm ids={current} enabled={aiConfigured()} />
          </div>
        </>
      ) : (
        <Panel className="space-y-1 text-sm text-muted">
          <p>{scripts.length === 0 ? "Kies twee tot vier aandoeningen om naast elkaar te zetten." : "Kies nog minstens één aandoening om mee te vergelijken."}</p>
          {addable.length === 0 ? (
            <p>
              Er zijn geen andere goedgekeurde scripts. Maak er een op{" "}
              <Link className="underline" href="/scripts">
                Illness scripts
              </Link>
              .
            </p>
          ) : null}
        </Panel>
      )}
    </>
  );
}
