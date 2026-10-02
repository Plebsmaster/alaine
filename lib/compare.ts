// Illness scripts vergelijken (ontwerp 1p): welke scripts en welke modus staan in de URL.
// Toevoegen en verwijderen gaat via links, dus zonder JavaScript en deelbaar.

export const MAX_COMPARE = 4;

export type CompareMode = "lezen" | "overhoren";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unieke, geldige script-id's uit `?id=`, in volgorde en hooguit vier. */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(list.filter((x) => UUID.test(x)))].slice(0, MAX_COMPARE);
}

export function parseCompareMode(raw: string | string[] | undefined): CompareMode {
  return raw === "overhoren" ? "overhoren" : "lezen";
}

/** Link naar de vergelijking met deze scripts (hooguit vier) in deze modus. */
export function compareHref(ids: string[], mode: CompareMode): string {
  const params = new URLSearchParams();
  for (const id of [...new Set(ids)].slice(0, MAX_COMPARE)) params.append("id", id);
  if (mode === "overhoren") params.set("modus", "overhoren");
  const query = params.toString();
  return query ? `/scripts/vergelijk?${query}` : "/scripts/vergelijk";
}
