"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { newSchedule } from "@/lib/fsrs";

const approveInput = z.object({
  id: z.uuid(),
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(2000),
  explanation: z.string().max(10_000),
});

export async function approveCardAction(input: z.infer<typeof approveInput>) {
  const parsed = approveInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Voor- en achterkant zijn verplicht (max. 2.000 tekens)." };
  const { supabase } = await requireUser();
  const { id, front, back, explanation } = parsed.data;
  const { error } = await supabase.rpc("approve_card", {
    p_card_id: id,
    p_front: front,
    p_back: back,
    p_explanation: explanation,
    p_schedule: newSchedule(new Date()),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/vandaag");
  return { ok: true as const };
}

export async function rejectCardAction(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").delete().eq("id", id).eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
