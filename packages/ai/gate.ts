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
const SPELLED = new Set([...ONES.slice(3), ...TENS.slice(2), ...ORDINALS, 'hundred', 'thousand', 'million', 'dozen']);
const NUMBER_WORDS = new Set([...SPELLED, ...ONES.slice(1)]);
/** Abbreviations and initials whose full stop does not end a sentence, so "Mr. Lestrade" and "J. Lestrade" are checked. */
const TITLE = /\b(Mr|Mrs|Ms|Dr|St|Rev|Capt|Col|Sgt|Insp|Prof|Messrs)\./gi;
const INITIAL = /\b([A-Z])\./g;
/** A number the clock licenses is a time only beside one of these: "gone eight", "a quarter to nine", "fifteen minutes". */
const BEFORE_TIME = new Set(['past', 'to', 'after', 'gone', 'at', 'till', 'until', 'struck', 'strike', 'strikes', 'chimed', 'chimes', 'half', 'quarter']);
const AFTER_TIME = new Set(["o'clock", 'oclock', 'minutes', 'minute', 'hours', 'hour', 'past', 'to']);
const ROMAN = /^[IVXLCDM]+$/;

export interface Invention { kind: 'name' | 'number'; token: string }
export interface GateVerdict { ok: boolean; inventions: Invention[] }

/** 1..99 in words, e.g. 45 → "forty five". */
function spell(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}
const figures = (n: number) => [String(n), ...(n > 0 && n < 100 ? spell(n).split(' ') : [])];

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
 * Every word the narrator was told this turn, apart from the clock's numbers
 * (`timeWords`). Nothing the player wrote is in it, and of what a model wrote
 * only the Observations, which are themselves checked strictly before they
 * become canon. Left out on purpose: the turn's Events (an id licensed a first
 * name, a Tick's draw almost any number, the player's text whatever they typed)
 * and the Transcript (the player's lines, and the narrator's own earlier
 * prose, which would make one slip a licence for good). What an Event means
 * for the prose reaches the context as labels, names, places, beats and facts.
 */
export function contextWords(ctx: NarrationContext): Set<string> {
  const parts: string[] = [
    // Not the Story's title: it is the game's chrome, not the world, and may name what an act must not.
    ctx.act.name, ctx.act.dateLabel, ctx.clock.period, ctx.clock.weather,
    ctx.location.name, ...ctx.location.beats,
    ...ctx.personsPresent.flatMap(p => [p.label, p.disposition, ...p.beats]),
    ...ctx.personsNamed.map(p => p.label),
    ...ctx.placesNamed.map(p => p.name),
    ...ctx.objectsVisible.map(o => o.name),
    ...ctx.beats,
    ...ctx.facts.flatMap(f => [f.statement, f.voice ?? '']),
    ...ctx.observations.map(o => o.text),
    ...ctx.ledger.flatMap(l => [...l.told, ...l.heard]),
    ...ctx.lexicon,
    ...(ctx.narrator ? [ctx.narrator.name, ...ctx.narrator.aliases, ...ctx.narrator.voice] : []),
  ];
  return new Set(tokens(parts.join(' ')));
}

/** The numbers the clock and the turn's elapsed minutes license, and only as a time. */
export function timeWords(ctx: NarrationContext): Set<string> {
  return new Set([...clockWords(ctx.clock.minutes), ...elapsedWords(ctx)].flatMap(tokens));
}

/**
 * Sentences, each with whether its first word is exempt from the name check.
 * An abbreviation's or an initial's full stop does not end a sentence. A
 * sentence after a closing quotation that ended on ? or ! is dialogue being
 * attributed (`"Who is it?" Pemberton asked`), so its first word is checked.
 */
function sentences(text: string): Array<{ text: string; exemptFirst: boolean }> {
  const parts = text.replace(TITLE, '$1').replace(INITIAL, '$1').split(/(?<=[.!?…]["”’')]*)\s+/).map(p => p.trim()).filter(Boolean);
  return parts.map((p, i) => ({ text: p, exemptFirst: i === 0 || !/[?!]["”’']$/.test(parts[i - 1]) }));
}

/**
 * Proper nouns and numeric specifics in `prose` that appear nowhere in the
 * context. A word is matched whole, or as a plural or possessive of a context
 * word ("the Kemps"). The first word of a sentence is not checked, since
 * grammar capitalises it and no word list can tell a name there from any other
 * word; `strict` checks it too, for text that is kept with no narration around
 * it (an Observation, a sentence the fallback salvages).
 */
export function findInventions(prose: string, ctx: NarrationContext, opts: { strict?: boolean } = {}): Invention[] {
  const words = contextWords(ctx);
  const time = timeWords(ctx);
  const known = (w: string) => {
    const t = w.toLowerCase();
    return GENERIC.has(t) || FUNCTION_WORDS.has(t) || words.has(t) || (t.endsWith('s') && words.has(t.slice(0, -1)));
  };
  const found = new Map<string, Invention>();
  const text = prose.replace(/[*_#>]/g, ' ');

  for (const sentence of sentences(text)) {
    const body = sentence.exemptFirst && !opts.strict ? sentence.text.replace(/^[^\s]+\s*/, '') : sentence.text;
    // A capitalised word of two letters or more, any alphabet, with inner capitals ("McCarthy"); or a word in capitals ("LESTRADE").
    const names = [
      ...body.matchAll(/(?<![\p{L}\d])(\p{Lu}\p{Ll}+(?:\p{Lu}\p{Ll}+)*)(?![\p{L}\d])/gu),
      ...body.matchAll(/(?<![\p{L}\d])(\p{Lu}{2,})(?![\p{L}\d])/gu),
    ].map(m => m[1]);
    for (const name of names) {
      if (known(name) || ROMAN.test(name)) continue;
      found.set(`name:${name.toLowerCase()}`, { kind: 'name', token: name });
    }
  }
  // Every digit run, letters attached or not ("31st", "3s 4d"), and every spelled number. A run of
  // number words ("twenty-five") is a time if the word before or after the run marks one.
  const toks = [...text.toLowerCase().replace(/’/g, "'").matchAll(/[\p{L}']+|\d+/gu)].map(m => m[0].replace(/^'+|'+$/g, ''));
  const isNumber = (t: string) => /^\d+$/.test(t) || NUMBER_WORDS.has(t);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!(/^\d+$/.test(t) || SPELLED.has(t)) || SMALL_COUNTS.has(t) || words.has(t)) continue;
    let a = i, b = i;
    while (a > 0 && isNumber(toks[a - 1])) a--;
    while (b < toks.length - 1 && isNumber(toks[b + 1])) b++;
    if (time.has(t) && (BEFORE_TIME.has(toks[a - 1]) || AFTER_TIME.has(toks[b + 1]))) continue;
    found.set(`num:${t}`, { kind: 'number', token: t });
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
