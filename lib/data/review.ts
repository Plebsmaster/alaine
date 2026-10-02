import "server-only";

import type { Schedule } from "@/lib/fsrs";
import { buildDailyQueue, type DailyQueue, type QueueItem } from "@/lib/queue";
import type { ServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { dayBounds, localDate } from "@/lib/time";
import type { UserSettings } from "./settings";

type Row = Database["public"]["Views"]["review_queue"]["Row"];

/** Wat de client nodig heeft om een kaart te tonen. */
export type ReviewCard = QueueItem & {
  type: string;
  front: string;
  back: string;
  explanation: string | null;
  image_url: string | null;
  source_label: string | null;
  topic_name: string;
};

const COLUMNS =
  "card_id, topic_id, type, front, back, explanation, image_path, source_label, created_at, topic_name, topic_sort, module_sort, exam_date, objective_sort, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review";

function toSchedule(r: Row): Schedule {
  return {
    due: r.due!,
    stability: r.stability ?? 0,
    difficulty: r.difficulty ?? 0,
    elapsed_days: r.elapsed_days ?? 0,
    scheduled_days: r.scheduled_days ?? 0,
    learning_steps: r.learning_steps ?? 0,
    reps: r.reps ?? 0,
    lapses: r.lapses ?? 0,
    state: r.state ?? 0,
    last_review: r.last_review,
  };
}

function toCard(r: Row, imageUrls: Map<string, string>): ReviewCard {
  return {
    card_id: r.card_id!,
    topic_id: r.topic_id!,
    schedule: toSchedule(r),
    exam_date: r.exam_date,
    module_sort: r.module_sort ?? 0,
    topic_sort: r.topic_sort ?? 0,
    objective_sort: r.objective_sort,
    created_at: r.created_at!,
    type: r.type!,
    front: r.front!,
    back: r.back!,
    explanation: r.explanation,
    image_url: r.image_path ? imageUrls.get(r.image_path) ?? null : null,
    source_label: r.source_label || null,
    topic_name: r.topic_name ?? "",
  };
}

export type TodayData = {
  queue: ReviewCard[];
  pending: ReviewCard[];
  counts: DailyQueue["counts"];
  estimateMinutes: number;
  endOfDay: string;
  /** Moment van opbouwen (ms); de client vergelijkt dit met een lokaal bewaarde stand. */
  generatedAt: number;
};

export async function loadToday(
  supabase: ServerClient,
  settings: UserSettings,
  now = new Date(),
): Promise<TodayData> {
  const { start, end } = dayBounds(now, settings.timezone);
  const t = localDate(now, settings.timezone);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

  const [dueRes, newRes, startedRes, durRes] = await Promise.all([
    supabase
      .from("review_queue")
      .select(COLUMNS)
      .neq("state", 0)
      .lt("due", end.toISOString())
      .order("due")
      .limit(2000),
    supabase
      .from("review_queue")
      .select(COLUMNS)
      .eq("state", 0)
      .eq("reps", 0)
      .order("upcoming_exam_date", { ascending: true, nullsFirst: false })
      .order("module_sort")
      .order("topic_sort")
      .order("objective_sort", { ascending: true, nullsFirst: false })
      .order("created_at")
      .limit(settings.max_new_per_day),
    supabase
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("state", 0)
      .gte("review", start.toISOString()),
    supabase
      .from("review_logs")
      .select("duration_ms")
      .not("duration_ms", "is", null)
      .order("review", { ascending: false })
      .limit(200),
  ]);
  for (const r of [dueRes, newRes, startedRes, durRes]) {
    if (r.error) throw new Error(`Wachtrij laden mislukt: ${r.error.message}`);
  }

  const rows = [...(dueRes.data ?? []), ...(newRes.data ?? [])] as Row[];
  const imageUrls = await signImages(supabase, rows);
  const cards = rows.map((r) => toCard(r, imageUrls));

  const daily = buildDailyQueue(cards, {
    now,
    endOfDay: end,
    today,
    maxNewPerDay: settings.max_new_per_day,
    newStartedToday: startedRes.count ?? 0,
  });

  const durations = (durRes.data ?? []).map((d) => d.duration_ms!).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 12_000;
  const perCard = Math.min(60_000, Math.max(5_000, median));
  const total = daily.queue.length + daily.pending.length;

  return {
    queue: daily.queue as ReviewCard[],
    pending: daily.pending as ReviewCard[],
    counts: daily.counts,
    estimateMinutes: Math.max(total > 0 ? 1 : 0, Math.round((total * perCard * 1.3) / 60_000)),
    endOfDay: end.toISOString(),
    generatedAt: now.getTime(),
  };
}

async function signImages(supabase: ServerClient, rows: Row[]): Promise<Map<string, string>> {
  const paths = [...new Set(rows.map((r) => r.image_path).filter((p): p is string => !!p))];
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage.from("card-images").createSignedUrls(paths, 60 * 60 * 6);
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

/** Aantal kaarten dat morgen klaarstaat (herhalingen; nieuwe kaarten tellen niet mee). */
export async function countDueTomorrow(supabase: ServerClient, settings: UserSettings, now = new Date()) {
  const { end } = dayBounds(now, settings.timezone, 1);
  const { count } = await supabase
    .from("review_queue")
    .select("card_id", { count: "exact", head: true })
    .neq("state", 0)
    .lt("due", end.toISOString());
  return count ?? 0;
}
