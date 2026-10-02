import "server-only";

import type { ServerClient } from "@/lib/supabase/server";
import { dayBounds, daysUntil, localDate } from "@/lib/time";
import type { UserSettings } from "./settings";

export type ShellData = {
  /** Kaarten die vandaag aan de beurt zijn: herhalingen plus de nieuwe kaarten van vandaag. */
  today: number;
  /** Concepten op Goedkeuren (kaarten, scripts, casussen, vragen). */
  drafts: number;
  /** Eerstvolgende toets, als er een toetsdatum is. */
  exam: { module: string; days: number } | null;
};

/** Tellers voor de navigatie. Alleen tellingen (head-queries), zodat elke pagina snel blijft. */
export async function loadShellData(supabase: ServerClient, settings: UserSettings, now = new Date()): Promise<ShellData> {
  const { start, end } = dayBounds(now, settings.timezone);
  const t = localDate(now, settings.timezone);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  const head = { count: "exact" as const, head: true };

  const [due, fresh, started, cards, scripts, cases, questions, exam] = await Promise.all([
    supabase.from("review_queue").select("card_id", head).neq("state", 0).lt("due", end.toISOString()),
    supabase.from("review_queue").select("card_id", head).eq("state", 0).eq("reps", 0),
    supabase.from("review_logs").select("id", head).eq("state", 0).gte("review", start.toISOString()),
    supabase.from("cards").select("id", head).eq("status", "draft"),
    supabase.from("illness_scripts").select("id", head).eq("status", "draft"),
    supabase.from("cases").select("id", head).eq("status", "draft"),
    supabase.from("questions").select("id", head).eq("status", "draft"),
    supabase
      .from("modules")
      .select("name, exam_date")
      .gte("exam_date", today)
      .order("exam_date")
      .limit(1)
      .maybeSingle(),
  ]);

  // Zelfde limiet als de wachtrij (lib/queue.ts): max nieuw per dag min wat al is gestart.
  const room = Math.max(0, settings.max_new_per_day - (started.count ?? 0));
  return {
    today: (due.count ?? 0) + Math.min(fresh.count ?? 0, room),
    drafts: (cards.count ?? 0) + (scripts.count ?? 0) + (cases.count ?? 0) + (questions.count ?? 0),
    exam: exam.data?.exam_date
      ? { module: exam.data.name, days: daysUntil(exam.data.exam_date, now, settings.timezone) }
      : null,
  };
}
