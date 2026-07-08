export const OPENING_FALLBACK_NARRATIVE =
  "> *221B Baker Street. November 1888. The sitting room is no longer quite a sitting room.*\n\nHolmes paces before the fire, his pipe cold in his hand. The case files are everywhere — pinned, spread, stacked. Five murders. Eleven weeks. Scotland Yard is floundering.\n\n**Sherlock Holmes** is here.\n**Objects of interest:** Case Files Wall, Newspapers, Chemistry Table, Watson's Armchair.\n**Possible exits:** Dorset Street.";

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
