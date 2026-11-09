/**
 * scripts/qa-gate.ts — self-test of the invention gate against a real toy turn.
 * Known inventions must be caught; the authored beats, the Story's lexicon and
 * the narrator's own name must pass. Run: npx tsx scripts/qa-gate.ts
 */
import { join } from 'node:path';
import { Story } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { buildNarrationContext, initialState, resolveTurn } from '../packages/engine';
import { fixedRng } from '../packages/engine/rng';
import { gateNarration } from '../packages/ai/gate';

const raw = loadStoryDir(join('packages', 'schema', 'fixtures', 'toy')) as Record<string, unknown>;
raw.narrator = { name: 'Inspector Marsh', aliases: ['the inspector'], voice: ['first person, past tense'] };
raw.lexicon = ['Kent'];
const story = Story.parse(raw);

let fails = 0;
const check = (c: boolean, l: string, d?: string) => { console.log(`[${c ? 'PASS' : 'FAIL'}] ${l}${!c && d ? ` — ${d}` : ''}`); if (!c) fails++; };

const s0 = initialState(story, 1);
const r = resolveTurn(story, s0, { text: 'ask about the key', selection: { kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' } }, fixedRng([0]));
const ctx = buildNarrationContext(story, r.state, r.events, 'full');
const verdict = (prose: string, obs: { key: string; subject: string; text: string }[] = []) => gateNarration(ctx, { prose, observations: obs });

check(verdict('The housekeeper said the master kept the study key inside the long-case clock. I thanked her and turned to the clock.').ok, 'authored facts and context names pass');
check(verdict('Marsh is my name, and I was born in Kent.').ok, 'narrator name and lexicon pass');
check(!verdict('"Mr Pemberton will be furious," she said.').ok, 'a borrowed name is caught', JSON.stringify(verdict('"Mr Pemberton will be furious," she said.')));
check(!verdict('It had rained for nine days and the clock said 4 o\'clock.').ok, 'numeric specifics are caught');
check(verdict('She said it twice, and I believed both times.').ok, 'small counts pass');
check(!verdict('Fine.', [{ key: 'clock_maker', subject: 'hall_clock', text: 'A brass plate reads Thwaites of Clerkenwell.' }]).ok, 'an invention inside an Observation is caught');
check(verdict('Fine.', [{ key: 'clock_grain', subject: 'hall_clock', text: 'The walnut is worn pale where hands have rested.' }]).ok, 'flavour without names passes');

// Review findings H8 and M7 (docs/reviews/engine-review-2026-11.md).
const withEvents = (events: typeof ctx.events) => ({ ...ctx, events: [...ctx.events, ...events] });
const caught = (c: typeof ctx, prose: string) => gateNarration(c, { prose, observations: [] }).inventions.map(i => i.token);
const tickCtx = withEvents([{ kind: 'TickResolved', minutes: 15, draw: 0.7312958, rule: null }, { kind: 'ClockAdvanced', minutes: 15 }]);
check(caught(tickCtx, 'She says 29 people came, at 12 past the hour.').join() === '29,12', 'a Tick\'s draw and minutes license no number');
const typed = withEvents([{ kind: 'TurnReceived', text: 'ask about Mary Kelly and the 40 barrels' }, { kind: 'FlavourRequested', subject: 'the Pemberton portrait' }]);
check(['Kelly', '40', 'Pemberton'].every(t => caught(typed, 'She frowned at the mention of Kelly, and of 40 casks, and of the Pemberton portrait.').includes(t)), 'the player\'s own words license nothing');
check(caught(withEvents([{ kind: 'Deduced', facts: [], suspect: 'pemberton' }]), 'You name him, and she says that Pemberton never came.').includes('Pemberton'), 'an id in an Event does not license a name');
check(['McCarthy', 'Bo'].every(t => caught(ctx, 'The constable, McCarthy, nodded to Bo.').includes(t)), 'a Mc-name and a two-letter name are caught');
check(caught(ctx, '"Go," Pemberton said.').includes('Pemberton'), 'a name right after closing dialogue is caught');
check(['fourteen', 'sixty', 'dozen'].every(t => caught(ctx, 'Some fourteen casks, sixty gallons, a dozen men.').includes(t)), 'teens, tens and a dozen are numbers');
check(caught(ctx, 'There were 66 of them.').includes('66'), 'a number is matched whole, not inside another');
check(ctx.clock.minutes === 1235, 'the turn above is at 20:35', String(ctx.clock.minutes));
check(verdict('It was gone eight, near enough, when the Inspector and two French sailors came; she said, "Yes."').ok, 'the hour in words, ranks, nationalities and a quoted reply pass');
check(!verdict('It was gone nine when she came.').ok, 'an hour other than the clock\'s is still an invention');

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
