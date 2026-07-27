// Shown only when the opening narration call fails (no key, network error), so
// it must stand on its own as a playable first screen. Re-dressed for the
// chronological rework: Act 0 is the August Bank Holiday, three weeks before the
// first murder. Nothing here may reference a case, a victim, or the autumn.
export const OPENING_FALLBACK_NARRATIVE =
  "> *221B Baker Street. August 1888. Both windows stand open, and the holiday shows no sign of going home.*\n\nHolmes stands at the window with his back to the room, watching the crowds move along the pavement below. There is no case. There has not been one worth the name in some weeks, and he has remarked on it twice already this evening.\n\nA woman waits in the chair by the door, holding her gloves in her lap.\n\n**Sherlock Holmes** and **Mrs. Kemp** are here.\n**Objects of interest:** Nell's Pawn Ticket, The Concluded Case, Holmes' Chemistry Table, The Violin Case.\n**Possible exits:** None tonight.";

// Extract the first prose sentence of a narration (skipping act headers and
// blockquotes) — used as anti-repetition memory for the AI.
export function extractOpeningSentence(markdown: string): string | null {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('**'));
  if (!line) return null;
  const sentence = line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line;
  return sentence.length > 90 ? sentence.slice(0, 90) + '…' : sentence;
}
