// Brondeel bij AI-concepten (ontwerp 1n, principe 10): staat het citaat echt letterlijk in de
// meegegeven brontekst? Verschillen in witruimte, aanhalingstekens, streepjes en hoofdletters
// tellen niet mee; een afkappunt ("…") aan begin of eind ook niet.

export const MAX_EXCERPT = 600;

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/­/g, "") // zacht afbreekstreepje
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Het citaat zonder afkappunten aan begin en eind. */
function core(excerpt: string): string {
  return excerpt
    .trim()
    .replace(/^(?:\.\.\.|…)\s*/, "")
    .replace(/\s*(?:\.\.\.|…)$/, "")
    .trim();
}

/** true als het citaat (genormaliseerd) letterlijk in de brontekst voorkomt. */
export function isLiteralExcerpt(source: string, excerpt: string): boolean {
  const quote = normalize(core(excerpt));
  if (quote.length < 8) return false; // te kort om iets te bewijzen
  return normalize(source).includes(quote);
}

/**
 * Wat er van een AI-citaat wordt bewaard: het citaat als het letterlijk in de bron staat,
 * anders niets en dan moet de kaart gecontroleerd worden.
 */
export function checkExcerpt(source: string, excerpt: string): { excerpt: string | null; needsVerification: boolean } {
  const trimmed = excerpt.trim();
  if (!trimmed) return { excerpt: null, needsVerification: true };
  if (!isLiteralExcerpt(source, trimmed)) return { excerpt: null, needsVerification: true };
  return { excerpt: trimmed.slice(0, MAX_EXCERPT), needsVerification: false };
}
