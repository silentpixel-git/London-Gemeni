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

/** Vocabulary that is never story-specific: honorifics, ranks, nationalities, calendar words. */
const GENERIC = new Set([
  'mr', 'mrs', 'miss', 'ms', 'dr', 'st', 'doctor', 'sir', 'madam', 'lord', 'lady', 'master', 'mistress',
  'inspector', 'sergeant', 'constable', 'superintendent', 'detective', 'captain', 'colonel', 'major',
  'reverend', 'father', 'sister', 'professor', 'officer', 'chief', 'commissioner',
  'english', 'british', 'scottish', 'irish', 'welsh', 'french', 'german', 'dutch', 'italian', 'spanish',
  'russian', 'polish', 'jewish', 'american', 'european',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'god', 'heaven', 'christ',
]);
const SMALL_COUNTS = new Set(['one', 'two', 'a', 'an', 'single', 'both', 'half', 'first', 'second']);
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SPELLED = new RegExp(`\\b(${[...ONES.slice(3), ...TENS.slice(2), 'hundred', 'thousand', 'million', 'dozen'].join('|')})\\b`, 'gi');

export interface Invention { kind: 'name' | 'number'; token: string }
export interface GateVerdict { ok: boolean; inventions: Invention[] }

/** 1..99 in words, e.g. 45 → "forty five". */
function spell(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}

/** The clock of day in the words and figures a narrator would use for it: 20:30 → 20, 8, eight, 30, thirty. */
function clockWords(minutes: number): string[] {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60), mm = m % 60, h12 = h24 % 12 || 12;
  return [String(h24), String(h12), spell(h12), ...(mm ? [String(mm), spell(mm)] : [])];
}

/**
 * Every word the narrator was told this turn, lower-cased. The turn's Events
 * are deliberately not in it: their ids would license names (an id is often a
 * first name), their counters (a Tick's draw, its minutes) would license
 * almost any number, and the player's own text would license whatever they
 * typed. What an Event means for the prose reaches the context as labels,
 * names, beats and facts; only the engine's own rejection reasons are added.
 */
export function contextWords(ctx: NarrationContext): Set<string> {
  const parts: string[] = [
    ctx.storyTitle, ctx.act.name, ctx.act.dateLabel, ctx.clock.period, ctx.clock.weather, ...clockWords(ctx.clock.minutes),
    ctx.location.name, ...ctx.location.beats,
    ...ctx.personsPresent.flatMap(p => [p.label, p.disposition, ...p.beats]),
    ...ctx.personsNamed.map(p => p.label),
    ...ctx.objectsVisible.map(o => o.name),
    ...ctx.beats,
    ...ctx.facts.flatMap(f => [f.statement, f.voice ?? '']),
    ...ctx.observations.map(o => o.text),
    ...ctx.ledger.flatMap(l => [...l.told, ...l.heard]),
    ...ctx.transcript.flatMap(t => t.lines.map(l => l.text)),
    ...ctx.lexicon,
    ...(ctx.narrator ? [ctx.narrator.name, ...ctx.narrator.aliases, ...ctx.narrator.voice] : []),
    ...ctx.events.flatMap(e => (e.kind === 'IntentRejected' ? [e.reason] : [])),
  ];
  return new Set(parts.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * Sentences, with an opening quotation mark starting a new one: the first word
 * of a sentence or of a quotation is capitalised by grammar, not because it is
 * a name. A closing quotation mark does not, so in `"Go," Holmes said` the
 * name is still checked.
 */
function sentences(text: string): string[] {
  return text
    .replace(/(^|\s)["‘(]/g, '$1\n').replace(/“/g, '\n')
    .split(/\n|(?<=[.!?…]["”’)]*)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Proper nouns and numeric specifics in `prose` that appear nowhere in the
 * context. A word is matched whole, or as a plural or possessive of a context
 * word ("the Kemps").
 */
export function findInventions(prose: string, ctx: NarrationContext): Invention[] {
  const words = contextWords(ctx);
  const known = (w: string) => { const t = w.toLowerCase(); return GENERIC.has(t) || words.has(t) || (t.endsWith('s') && words.has(t.slice(0, -1))); };
  const found = new Map<string, Invention>();
  const text = prose.replace(/[*_#>]/g, ' ');

  for (const sentence of sentences(text)) {
    const body = sentence.replace(/^[^\s]+\s*/, '');
    // A capital after the first letter too, so "McCarthy" is one name; two letters is enough ("Bo").
    for (const m of body.matchAll(/\b([A-Z][a-z]*(?:[A-Z][a-z]+)*)\b/g)) {
      if (m[1].length < 2 || known(m[1])) continue;
      found.set(`name:${m[1].toLowerCase()}`, { kind: 'name', token: m[1] });
    }
  }
  for (const m of text.matchAll(/\b(\d+)\b/g)) {
    if (!words.has(m[1])) found.set(`num:${m[1]}`, { kind: 'number', token: m[1] });
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
