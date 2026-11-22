// The invention gate (ADR-0002): prose may not contain a proper noun or a
// numeric specific that appears in neither the turn's context nor the
// Investigation's Observations in scope. Ported from the old engine's
// detector, which caught two live bugs prompt rules had already forbidden:
// a name borrowed from wider canon, and a fabricated quantity.
//
// Story-agnostic on purpose: the only names allowed without context are the
// Story's narrator and its declared lexicon. Everything else must be earned
// by the turn.
import type { NarrationContext, NarrationResult } from '../schema/index.js';

/** Vocabulary that is never story-specific: honorifics, calendar words, counting. */
const GENERIC = new Set([
  'mr', 'mrs', 'miss', 'ms', 'dr', 'doctor', 'sir', 'madam', 'lord', 'lady', 'master', 'mistress',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'god', 'heaven',
]);
const SMALL_COUNTS = new Set(['one', 'two', 'a', 'an', 'single', 'both', 'half', 'first', 'second']);
const SPELLED = /\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand)\b/gi;

export interface Invention { kind: 'name' | 'number'; token: string }
export interface GateVerdict { ok: boolean; inventions: Invention[] }

/**
 * Every word the narrator was given this turn, flattened. Words only: an id is not
 * a name, though it is often the real one (a person's id licensed their name before
 * their introduction), and an Event's numbers are the engine's (a Tick's draw holds
 * most one- and two-digit runs). Of the Events, only the player's own line counts;
 * what they reference reaches the narrator by name through the projections.
 */
export function contextHaystack(ctx: NarrationContext): string {
  const parts: string[] = [
    ctx.storyTitle, ctx.act.name, ctx.act.dateLabel, ctx.clock.period, ctx.clock.weather,
    ctx.location.name, ...ctx.location.beats,
    ...ctx.personsPresent.flatMap(p => [p.label, p.disposition, ...p.beats]),
    ...ctx.objectsVisible.map(o => o.name),
    ...ctx.personsNamed.map(p => p.label),
    ...ctx.placesNamed.map(p => p.name),
    ...ctx.beats,
    ...ctx.facts.flatMap(f => [f.statement, f.voice ?? '']),
    ...ctx.observations.map(o => o.text),
    ...ctx.ledger.flatMap(l => [...l.told, ...l.heard]),
    ...ctx.transcript.flatMap(t => t.lines.map(l => l.text)),
    ...ctx.lexicon,
    ...(ctx.narrator ? [ctx.narrator.name, ...ctx.narrator.aliases, ...ctx.narrator.voice] : []),
    ...ctx.events.flatMap(e => (e.kind === 'TurnReceived' ? [e.text] : [])),
  ];
  return parts.join(' \n ').toLowerCase();
}

/**
 * Proper nouns and numeric specifics in `prose` that appear nowhere in the
 * context, each matched whole. Sentence-initial words are skipped:
 * capitalisation there is grammar, not a name, and was the dominant false
 * positive before.
 */
export function findInventions(prose: string, ctx: NarrationContext): Invention[] {
  const hay = contextHaystack(ctx);
  // Whole words: "Ines" is not earned by "lines", nor "ten" by "often".
  const words = new Set(hay.match(/[a-z]+/g) ?? []);
  const found = new Map<string, Invention>();
  const text = prose.replace(/[*_#>]/g, ' ');

  for (const sentence of text.split(/(?<=[.!?"”])\s+/)) {
    const body = sentence.trim().replace(/^[^\s]+\s*/, '');
    for (const m of body.matchAll(/\b([A-Z][a-z]{2,})\b/g)) {
      const lower = m[1].toLowerCase();
      if (GENERIC.has(lower) || words.has(lower)) continue;
      found.set(`name:${lower}`, { kind: 'name', token: m[1] });
    }
  }
  // Whole numbers only: "29" is not earned by a context that says "1290".
  const numbers = new Set(hay.match(/\d+/g) ?? []);
  for (const m of text.matchAll(/\b(\d+)\b/g)) {
    if (!numbers.has(m[1])) found.set(`num:${m[1]}`, { kind: 'number', token: m[1] });
  }
  for (const m of text.matchAll(SPELLED)) {
    const lower = m[1].toLowerCase();
    if (SMALL_COUNTS.has(lower) || words.has(lower)) continue;
    found.set(`num:${lower}`, { kind: 'number', token: m[1] });
  }
  return [...found.values()];
}

/** Prose and Observations are both checked; an Observation is canon the moment it is accepted. */
export function gateNarration(ctx: NarrationContext, result: NarrationResult): GateVerdict {
  const inventions = [
    ...findInventions(result.prose, ctx),
    ...result.observations.flatMap(o => findInventions(o.text, ctx)),
  ];
  const seen = new Set<string>();
  const unique = inventions.filter(i => { const k = `${i.kind}:${i.token.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: unique.length === 0, inventions: unique };
}
