import "server-only";

import type { ServerClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/time";

export type UserSettings = {
  desired_retention: number;
  max_new_per_day: number;
  fsrs_params: number[] | null;
  timezone: string;
};

export const DEFAULT_SETTINGS: UserSettings = {
  desired_retention: 0.9,
  max_new_per_day: 20,
  fsrs_params: null,
  timezone: "Europe/Amsterdam",
};

/** Instellingen van de gebruiker; maakt de rij aan met standaardwaarden als die nog niet bestaat. */
export async function getSettings(supabase: ServerClient): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("desired_retention, max_new_per_day, fsrs_params, timezone")
    .maybeSingle();
  if (error) throw new Error(`Instellingen laden mislukt: ${error.message}`);
  if (!data) {
    await supabase.from("settings").upsert({}, { onConflict: "user_id", ignoreDuplicates: true });
    return DEFAULT_SETTINGS;
  }
  return {
    desired_retention: Number(data.desired_retention),
    max_new_per_day: data.max_new_per_day,
    fsrs_params: Array.isArray(data.fsrs_params) ? (data.fsrs_params as number[]) : null,
    timezone: isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_SETTINGS.timezone,
  };
}
