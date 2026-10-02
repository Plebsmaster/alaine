import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { SCRIPT_FIELDS } from "../script-labels";
import { CompareCardForm } from "./compare-form";

export const metadata: Metadata = { title: "Scripts vergelijken" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ComparePage({ searchParams }: PageProps<"/scripts/vergelijk">) {
  const { id } = await searchParams;
  const ids = [...new Set((Array.isArray(id) ? id : id ? [id] : []).filter((x) => UUID.test(x)))].slice(0, 4);
  const { supabase } = await requireUser();

  const { data } = ids.length
    ? await supabase.from("illness_scripts").select("*").in("id", ids)
    : { data: [] };
  const scripts = ids.map((i) => (data ?? []).find((s) => s.id === i)).filter((s) => !!s);

  if (scripts.length < 2) {
    return (
      <>
        <PageHeader title="Scripts vergelijken" />
        <Panel className="text-sm text-muted">
          Kies minstens twee aandoeningen op <Link className="underline" href="/scripts">Illness scripts</Link>.
        </Panel>
      </>
    );
  }

  const rows = [
    ...SCRIPT_FIELDS.filter((f) => f.key !== "key_discriminators"),
    SCRIPT_FIELDS.find((f) => f.key === "key_discriminators")!,
  ];

  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/scripts" className="underline">Illness scripts</Link>
      </p>
      <PageHeader title="Naast elkaar">
        <CompareCardForm ids={scripts.map((s) => s.id)} enabled={aiConfigured()} />
      </PageHeader>

      {/* Veldnaam als eigen rij erboven, zodat de waarden de volle breedte delen: op de telefoon passen twee aandoeningen naast elkaar. */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: `${scripts.length * 9}rem` }}>
          <thead>
            <tr>
              {scripts.map((s) => (
                <th key={s.id} scope="col" className="border-b-2 border-border p-2 text-left text-base font-semibold">
                  <Link href={`/scripts/${s.id}`} className="hover:underline">
                    {s.condition}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          {rows.map((f) => (
            <tbody key={f.key} className={f.key === "key_discriminators" ? "bg-surface-2" : undefined}>
              <tr>
                <th scope="colgroup" colSpan={scripts.length} className="px-2 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  {f.label}
                </th>
              </tr>
              <tr>
                {scripts.map((s) => (
                  <td key={s.id} className="prose-card border-b border-border p-2 align-top">
                    {s[f.key] || <span className="text-muted">–</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
