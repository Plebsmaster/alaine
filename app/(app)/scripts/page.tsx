import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, LinkButton, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SCRIPT_STATUS_LABELS } from "./script-labels";

export const metadata: Metadata = { title: "Illness scripts" };

export default async function ScriptsPage({ searchParams }: PageProps<"/scripts">) {
  const { status: statusParam } = await searchParams;
  const status = typeof statusParam === "string" && statusParam in SCRIPT_STATUS_LABELS ? statusParam : "active";
  const { supabase } = await requireUser();

  const [{ data: scripts, error }, { data: counts }] = await Promise.all([
    supabase
      .from("illness_scripts")
      .select("id, condition, origin, similar_conditions, topics(id, name, sort_order)")
      .eq("status", status)
      .order("condition")
      .limit(1000),
    supabase.from("illness_scripts").select("status"),
  ]);
  if (error) throw new Error(error.message);

  const byStatus = new Map<string, number>();
  for (const c of counts ?? []) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);

  const groups = new Map<string, { name: string; sort: number; items: NonNullable<typeof scripts> }>();
  for (const s of scripts ?? []) {
    const key = s.topics?.id ?? "";
    const g = groups.get(key) ?? { name: s.topics?.name ?? "", sort: s.topics?.sort_order ?? 0, items: [] };
    g.items.push(s);
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Illness scripts">
        <LinkButton href="/scripts/nieuw" variant="primary">
          Nieuw script
        </LinkButton>
      </PageHeader>

      <nav className="mb-4 flex flex-wrap gap-1 text-sm" aria-label="Filter op status">
        {Object.entries(SCRIPT_STATUS_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/scripts?status=${key}`}
            aria-current={status === key ? "page" : undefined}
            className="rounded-lg px-3 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold"
          >
            {label} ({byStatus.get(key) ?? 0})
          </Link>
        ))}
      </nav>

      {sorted.length === 0 ? (
        <Panel className="text-sm text-muted">
          {status === "active"
            ? "Nog geen goedgekeurde scripts. Maak er een, laat AI een concept maken uit brontekst, of importeer ze."
            : "Geen scripts met deze status."}
        </Panel>
      ) : (
        <form action="/scripts/vergelijk" method="get" className="space-y-6">
          {status === "active" ? (
            <p className="text-sm text-muted">Vink twee of meer aandoeningen aan om ze naast elkaar te zetten.</p>
          ) : null}
          {sorted.map((g) => (
            <section key={g.name} className="space-y-2">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {g.items.map((s) => (
                  <li key={s.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                    {status === "active" ? (
                      <input type="checkbox" name="id" value={s.id} aria-label={`${s.condition} vergelijken`} className="h-5 w-5 shrink-0" />
                    ) : null}
                    <Link href={`/scripts/${s.id}`} className="flex-1 hover:underline">
                      {s.condition}
                    </Link>
                    {s.origin === "ai" ? <Badge>AI</Badge> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {status === "active" ? (
            <div className="sticky bottom-16 md:bottom-4">
              <Button variant="primary">Vergelijk geselecteerde</Button>
            </div>
          ) : null}
        </form>
      )}
    </>
  );
}
