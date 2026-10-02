import "server-only";

import { dayKey, errorProfile, LEECH_LAPSES, type ErrorCounts, minutesByDay, pastDays, retention, streak, workload } from "@/lib/dashboard";
import type { ServerClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/time";
import type { UserSettings } from "./settings";

const PAGE = 1000;

/** Alle rijen van een query, in pagina's van 1000 (PostgREST-limiet). */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export type TopicRow = {
  id: string;
  name: string;
  module: string;
  active: number;
  draft: number;
  dueToday: number;
  retention: number | null;
  retentionN: number;
  lastCaseScore: number | null;
  errors: ErrorCounts;
  errorAdvice: string | null;
};

export async function loadDashboard(supabase: ServerClient, settings: UserSettings, now = new Date()) {
  const tz = settings.timezone;
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const since14 = new Date(now.getTime() - 15 * 86_400_000).toISOString();
  const since60 = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  const [topics, modules, counts, queue, cards, logs, recentLogs, attempts, sessions, objectives, coverage, questionErrors] = await Promise.all([
    supabase.from("topics").select("id, name, sort_order, module_id").order("sort_order").then((r) => r.data ?? []),
    supabase.from("modules").select("id, name, sort_order, exam_date").order("sort_order").then((r) => r.data ?? []),
    supabase.from("topic_card_counts").select("*").then((r) => r.data ?? []),
    all((a, b) => supabase.from("review_queue").select("card_id, topic_id, front, due, state, reps, lapses").order("card_id").range(a, b)),
    all((a, b) => supabase.from("cards").select("id, topic_id").order("id").range(a, b)),
    all((a, b) => supabase.from("review_logs").select("card_id, state, rating, error_type").gte("review", since30).order("id").range(a, b)),
    all((a, b) => supabase.from("review_logs").select("review, duration_ms").gte("review", since14).order("id").range(a, b)),
    supabase
      .from("case_attempts")
      .select("created_at, self_score, duration_ms, error_type, cases(topic_id)")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then((r) => r.data ?? []),
    supabase.from("study_sessions").select("kind, started_at, ended_at").gte("started_at", since60).limit(5000).then((r) => r.data ?? []),
    supabase.from("learning_objectives").select("id, topic_id, code, description, sort_order").order("sort_order").then((r) => r.data ?? []),
    supabase.from("objective_coverage").select("*").then((r) => r.data ?? []),
    supabase
      .from("question_attempts")
      .select("error_type, questions(topic_id)")
      .gte("created_at", since30)
      .not("error_type", "is", null)
      .limit(5000)
      .then((r) => r.data ?? []),
  ]);

  const today = dayKey(now, tz);
  const cardTopic = new Map(cards.map((c) => [c.id, c.topic_id]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const countBy = new Map(counts.map((c) => [c.topic_id, c]));

  // Per thema
  const topicRows: TopicRow[] = [...topics]
    .sort((a, b) => (moduleById.get(a.module_id)?.sort_order ?? 0) - (moduleById.get(b.module_id)?.sort_order ?? 0) || a.sort_order - b.sort_order)
    .map((t) => {
      const r = retention(logs.filter((l) => cardTopic.get(l.card_id) === t.id));
      const lastCase = attempts.find((a) => a.cases?.topic_id === t.id);
      const profile = errorProfile([
        ...logs.filter((l) => cardTopic.get(l.card_id) === t.id).map((l) => l.error_type),
        ...attempts.filter((a) => a.cases?.topic_id === t.id && a.created_at >= since30).map((a) => a.error_type),
        ...questionErrors.filter((q) => q.questions?.topic_id === t.id).map((q) => q.error_type),
      ]);
      return {
        id: t.id,
        name: t.name,
        module: moduleById.get(t.module_id)?.name ?? "",
        active: Number(countBy.get(t.id)?.active ?? 0),
        draft: Number(countBy.get(t.id)?.draft ?? 0),
        dueToday: queue.filter((q) => q.topic_id === t.id && !(q.state === 0 && q.reps === 0) && dayKey(new Date(q.due!), tz) <= today).length,
        retention: r.value,
        retentionN: r.n,
        lastCaseScore: lastCase?.self_score ?? null,
        errors: profile.counts,
        errorAdvice: profile.advice,
      };
    });

  // Werklast komende 14 dagen
  const load = workload(
    queue.map((q) => ({ due: q.due!, state: q.state ?? 0, reps: q.reps ?? 0 })),
    now,
    tz,
  );

  // Leerdoelendekking: leerdoelen zonder actieve kaart of casus
  const cov = new Map(coverage.map((c) => [c.objective_id, c]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const uncovered = objectives
    .filter((o) => !(Number(cov.get(o.id)?.active_cards ?? 0) || Number(cov.get(o.id)?.active_cases ?? 0)))
    .map((o) => ({ ...o, topic: topicName.get(o.topic_id) ?? "" }));

  // Lastige kaarten
  const leeches = queue
    .filter((q) => (q.lapses ?? 0) >= LEECH_LAPSES)
    .sort((a, b) => (b.lapses ?? 0) - (a.lapses ?? 0))
    .slice(0, 30)
    .map((q) => ({ id: q.card_id!, front: q.front!, lapses: q.lapses ?? 0, topic: topicName.get(q.topic_id!) ?? "" }));

  // Toetsdata
  const exams = modules
    .filter((m) => m.exam_date)
    .map((m) => ({ name: m.name, date: m.exam_date!, days: daysUntil(m.exam_date!, now, tz) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days);

  // Studietijd en streak
  const days14 = pastDays(now, tz, 14);
  const durations = [
    ...recentLogs.map((l) => ({ at: l.review, ms: l.duration_ms ?? 0 })),
    ...attempts.filter((a) => a.created_at >= since14).map((a) => ({ at: a.created_at, ms: a.duration_ms ?? 0 })),
    ...sessions
      .filter((s) => (s.kind === "pretest" || s.kind === "exam") && s.ended_at)
      .map((s) => ({ at: s.started_at, ms: new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime() })),
  ];
  const minutes = minutesByDay(durations, days14, tz);
  const activeDays = new Set(sessions.map((s) => dayKey(new Date(s.started_at), tz)));
  const overall = retention(logs);

  return {
    topics: topicRows,
    workload: load,
    uncovered,
    leeches,
    exams,
    minutes,
    streak: streak(activeDays, today),
    minutesToday: minutes.at(-1)?.minutes ?? 0,
    dueToday: load[0]?.count ?? 0,
    retention: overall,
  };
}
