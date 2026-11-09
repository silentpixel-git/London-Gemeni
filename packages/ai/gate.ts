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

/**
 * Vocabulary that is never story-specific: honorifics and calendar words.
 * Ranks, nationalities and faiths are a Story's call (in a mystery they can
 * be clue-shaped), so they go in its `lexicon`.
 */
const GENERIC = new Set([
  'mr', 'mrs', 'miss', 'ms', 'dr', 'st', 'doctor', 'sir', 'madam', 'lord', 'lady', 'master', 'mistress',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'god', 'heaven',
]);
/** English words that are capitalised only by position (a quotation's first word, "Her Majesty"): never a name. */
const FUNCTION_WORDS = new Set([
  'i', 'a', 'an', 'the', 'it', 'its', 'you', 'your', 'we', 'our', 'us', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'their', 'me', 'my', 'this', 'that', 'these', 'those', 'there', 'here', 'what', 'why', 'how', 'who', 'whom', 'whose',
  'when', 'where', 'which', 'if', 'but', 'and', 'or', 'nor', 'not', 'no', 'yes', 'never', 'now', 'then', 'so', 'well',
  'oh', 'ah', 'aye', 'nay', 'come', 'go', 'look', 'listen', 'wait', 'stop', 'hush', 'all', 'some', 'any', 'nothing',
  'is', 'was', 'be', 'do', 'did', 'have', 'had', 'will', 'would', 'shall', 'should', 'can', 'could', 'must', 'let',
  'perhaps', 'still', 'only', 'just', 'even', 'indeed', 'quite', 'very', 'please', 'thank', 'good', 'after', 'before',
  'at', 'in', 'on', 'of', 'to', 'for', 'with', 'by', 'from', 'as', 'once', 'again', 'mind',
]);
const SMALL_COUNTS = new Set(['one', 'two', 'a', 'an', 'single', 'both', 'half', 'first', 'second']);
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINALS = ['third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'thirtieth', 'fortieth', 'fiftieth', 'hundredth'];
const SPELLED = new RegExp(`\\b(${[...ONES.slice(3), ...TENS.slice(2), ...ORDINALS, 'hundred', 'thousand', 'million', 'dozen'].join('|')})\\b`, 'gi');
/** Abbreviations whose full stop does not end a sentence, so "Mr. Lestrade" is checked. */
const ABBREVIATION = /\b(Mr|Mrs|Ms|Dr|St|Rev|Capt|Col|Sgt|Insp|Prof|Messrs)\./g;

export interface Invention { kind: 'name' | 'number'; token: string }
export interface GateVerdict { ok: boolean; inventions: Invention[] }

/** 1..99 in words, e.g. 45 → "forty five". */
function spell(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}
const figures = (n: number) => [String(n), ...(n > 0 && n < 100 ? [spell(n)] : [])];

/** The clock of day as a narrator tells it: 20:45 → 20, 8, eight, 45, forty five, and "a quarter to nine" (9, 15). */
function clockWords(minutes: number): string[] {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60), mm = m % 60, h12 = h24 % 12 || 12;
  return [String(h24), ...figures(h12), ...figures(h12 % 12 + 1), ...(mm ? [...figures(mm), ...figures(60 - mm)] : [])];
}

/** The minutes a turn took, in figures and words, and in hours when whole: "fifteen minutes", "half an hour", "an hour". */
function elapsedWords(ctx: NarrationContext): string[] {
  return ctx.events.flatMap(e => (e.kind === 'ClockAdvanced' || e.kind === 'TickResolved')
    ? [...figures(e.minutes), ...(e.minutes % 60 === 0 ? figures(e.minutes / 60) : [])] : []);
}

/** Letters or digit runs, lower-cased: "31st" is "31" and "st", "O'Brien" is "o" and "brien". */
const tokens = (text: string) => text.toLowerCase().match(/\p{L}+|\d+/gu) ?? [];

/**
 * Every word the narrator was told this turn. Nothing written by the player
 * or by a model is in it: not the turn's Events (an id licensed a first name,
 * a Tick's draw almost any number, the player's text whatever they typed, a
 * selection model's miss reason whatever it wrote), and not the player's own
 * lines in the Transcript. What an Event means for the prose reaches the
 * context as labels, names, beats and facts; only the minutes a turn took are
 * taken from its Events.
 */
export function contextWords(ctx: NarrationContext): Set<string> {
  const parts: string[] = [
    ctx.storyTitle, ctx.act.name, ctx.act.dateLabel, ctx.clock.period, ctx.clock.weather, ...clockWords(ctx.clock.minutes),
    ...elapsedWords(ctx),
    ctx.location.name, ...ctx.location.beats,
    ...ctx.personsPresent.flatMap(p => [p.label, p.disposition, ...p.beats]),
    ...ctx.personsNamed.map(p => p.label),
    ...ctx.placesNamed.map(p => p.name),
    ...ctx.objectsVisible.map(o => o.name),
    ...ctx.beats,
    ...ctx.facts.flatMap(f => [f.statement, f.voice ?? '']),
    ...ctx.observations.map(o => o.text),
    ...ctx.ledger.flatMap(l => [...l.told, ...l.heard]),
    ...ctx.transcript.flatMap(t => t.lines.filter(l => l.speaker === 'person').map(l => l.text)),
    ...ctx.lexicon,
    ...(ctx.narrator ? [ctx.narrator.name, ...ctx.narrator.aliases, ...ctx.narrator.voice] : []),
  ];
  return new Set(tokens(parts.join(' ')));
}

/** Sentences. An abbreviation's full stop ("Mr.") does not end one; a closing quotation mark after the stop belongs to it. */
function sentences(text: string): string[] {
  return text.replace(ABBREVIATION, '$1').split(/(?<=[.!?…]["”’')]*)\s+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Proper nouns and numeric specifics in `prose` that appear nowhere in the
 * context. A word is matched whole, or as a plural or possessive of a context
 * word ("the Kemps"). The first word of a sentence is not checked: grammar
 * capitalises it, and no word list can tell a name there from any other word.
 */
export function findInventions(prose: string, ctx: NarrationContext): Invention[] {
  const words = contextWords(ctx);
  const known = (w: string) => {
    const t = w.toLowerCase();
    return GENERIC.has(t) || FUNCTION_WORDS.has(t) || words.has(t) || (t.endsWith('s') && words.has(t.slice(0, -1)));
  };
  const found = new Map<string, Invention>();
  const text = prose.replace(/[*_#>]/g, ' ');

  for (const sentence of sentences(text)) {
    const body = sentence.replace(/^[^\s]+\s*/, '');
    // A capitalised word of two letters or more, any alphabet, with inner capitals ("McCarthy"); or a word in capitals ("LESTRADE").
    const names = [
      ...body.matchAll(/(?<![\p{L}\d])(\p{Lu}\p{Ll}+(?:\p{Lu}\p{Ll}+)*)(?![\p{L}\d])/gu),
      ...body.matchAll(/(?<![\p{L}\d])(\p{Lu}{2,})(?![\p{L}\d])/gu),
    ].map(m => m[1]);
    for (const name of names) {
      if (known(name)) continue;
      found.set(`name:${name.toLowerCase()}`, { kind: 'name', token: name });
    }
  }
  // Every digit run, letters attached or not: "31st", "3s 4d".
  for (const m of text.matchAll(/\d+/g)) {
    if (!words.has(m[0])) found.set(`num:${m[0]}`, { kind: 'number', token: m[0] });
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
