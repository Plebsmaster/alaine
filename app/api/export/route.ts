import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "modules",
  "topics",
  "learning_objectives",
  "sources",
  "illness_scripts",
  "cards",
  "card_objectives",
  "cases",
  "case_objectives",
  "questions",
  "question_objectives",
  "card_schedule",
  "review_logs",
  "case_attempts",
  "question_attempts",
  "study_sessions",
  "settings",
] as const;

const PAGE = 1000;

// Vaste volgorde, zodat pagineren geen rijen overslaat of dubbel geeft.
const ORDER: Partial<Record<(typeof TABLES)[number], string[]>> = {
  card_objectives: ["card_id", "objective_id"],
  case_objectives: ["case_id", "objective_id"],
  question_objectives: ["question_id", "objective_id"],
  card_schedule: ["card_id"],
  settings: ["user_id"],
};

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims || !isAllowedEmail(data.claims.email)) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const out: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase.from(table).select("*");
      for (const column of ORDER[table] ?? ["id"]) query = query.order(column);
      const { data: page, error } = await query.range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
      rows.push(...(page ?? []));
      if (!page || page.length < PAGE) break;
    }
    out[table] = rows;
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify({ format: "pa-studie-export", version: 1, exported_at: new Date().toISOString(), tables: out }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pa-studie-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
