import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PRETEST_MAX } from "@/lib/exam";
import { PretestRunner } from "./pretest-runner";

export const metadata: Metadata = { title: "Pretest" };

export default async function PretestPage({ params }: PageProps<"/oefentoets/pretest/[topicId]">) {
  const { topicId } = await params;
  const { supabase } = await requireUser();
  const [{ data: topic }, { data: questions }] = await Promise.all([
    supabase.from("topics").select("name").eq("id", topicId).maybeSingle(),
    // Alleen de vraag; het modelantwoord komt pas na het antwoorden.
    supabase.from("questions").select("id, stem").eq("topic_id", topicId).eq("kind", "pretest").eq("status", "active")
      // Import gebeurt in één transactie (zelfde created_at): dan de volgorde van de import-id's.
      .order("created_at")
      .order("external_id", { nullsFirst: false })
      .order("id")
      .limit(PRETEST_MAX),
  ]);
  if (!topic) notFound();
  if ((questions ?? []).length === 0) {
    return (
      <>
        <PageHeader title={`Pretest: ${topic.name}`} settings={false} />
        <Panel className="text-sm text-muted">Nog geen goedgekeurde pretestvragen voor dit thema.</Panel>
      </>
    );
  }
  // Eigen kop met vraagoverzicht (ontwerp 1t).
  return <PretestRunner questions={questions!} sessionId={crypto.randomUUID()} topicName={topic.name} />;
}
