import type { Metadata } from "next";
import Link from "next/link";
import { Badge, LinkButton, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Vragen" };

const STATUS: Record<string, string> = { active: "Actief", draft: "Concept", archived: "Gearchiveerd" };

export default async function QuestionsPage({ searchParams }: PageProps<"/oefentoets/vragen">) {
  const { status: s } = await searchParams;
  const status = typeof s === "string" && s in STATUS ? s : "active";
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("questions")
    .select("id, kind, format, stem, topics(name, sort_order)")
    .eq("status", status)
    .order("created_at")
    .order("external_id", { nullsFirst: false })
    .limit(1000);
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const q of data ?? []) {
    const key = q.topics?.name ?? "";
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  return (
    <>
      <p className="mb-1 text-sm text-muted">
        <Link href="/oefentoets" className="underline">Oefentoets</Link>
      </p>
      <PageHeader title="Vragen">
        <LinkButton href="/oefentoets/vraag/nieuw">Nieuwe vraag</LinkButton>
      </PageHeader>
      <nav className="mb-4 flex gap-1 text-sm" aria-label="Filter op status">
        {Object.entries(STATUS).map(([key, label]) => (
          <Link key={key} href={`/oefentoets/vragen?status=${key}`} aria-current={status === key ? "page" : undefined} className="rounded-lg px-3 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold">
            {label}
          </Link>
        ))}
      </nav>
      {groups.size === 0 ? <Panel className="text-sm text-muted">Geen vragen met deze status.</Panel> : null}
      <div className="space-y-6">
        {[...groups.entries()].map(([name, qs]) => (
          <section key={name} className="space-y-2">
            <h2 className="text-lg font-semibold">{name}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {qs.map((q) => (
                <li key={q.id}>
                  <Link href={`/oefentoets/vraag/${q.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                    <span className="line-clamp-2 text-sm">{q.stem}</span>
                    <span className="flex shrink-0 gap-1">
                      <Badge>{q.kind === "pretest" ? "pretest" : "toets"}</Badge>
                      <Badge>{q.format === "mcq" ? "MC" : "open"}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
