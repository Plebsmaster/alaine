import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { loadToday } from "@/lib/data/review";
import { getSettings } from "@/lib/data/settings";
import { ReviewSession } from "./review-session";

export const metadata: Metadata = { title: "Vandaag" };

export default async function TodayPage() {
  const { supabase, user } = await requireUser();
  const settings = await getSettings(supabase);
  const today = await loadToday(supabase, settings);
  const total = today.queue.length + today.pending.length;

  return (
    <>
      <PageHeader title="Vandaag">
        <p className="text-sm text-muted">
          {total === 0
            ? "Geen kaarten"
            : `${total} ${total === 1 ? "kaart" : "kaarten"} · ongeveer ${today.estimateMinutes} min`}
          {today.counts.new > 0 ? ` · ${today.counts.new} nieuw` : ""}
        </p>
      </PageHeader>
      <ReviewSession
        initialQueue={today.queue}
        initialPending={today.pending}
        settings={{ desired_retention: settings.desired_retention, fsrs_params: settings.fsrs_params }}
        endOfDay={today.endOfDay}
        userId={user.id}
        generatedAt={today.generatedAt}
        aiEnabled={aiConfigured()}
      />
    </>
  );
}
