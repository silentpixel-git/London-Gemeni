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
import { findInventions, gateNarration } from '../packages/ai/gate';

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
check(verdict('It was gone eight, near enough, and twenty-five to nine by the hall clock; she said, "Yes," and then, \'Never, sir.\'').ok, 'the hour in words (and "to the hour"), and quoted replies pass');
check(!verdict('It was gone ten when she came.').ok, 'an hour other than the clock\'s is still an invention');
check(['Sergeant', 'French'].every(t => caught(ctx, 'Then the Sergeant and two French sailors came.').includes(t)), 'ranks and nationalities are the Story\'s call: rejected without the lexicon');
check(gateNarration({ ...ctx, lexicon: [...ctx.lexicon, 'Sergeant', 'French'] }, { prose: 'Then the Sergeant and two French sailors came.', observations: [] }).ok, '…and accepted once the Story lists them');

// Engineering review of the first gate fix.
const asked = { ...ctx, transcript: [{ person: 'housekeeper', lines: [{ speaker: 'player' as const, text: 'ask the housekeeper about Mary Kelly and the 40 barrels' }] }] };
check(['Kelly', '40'].every(t => caught(asked, 'She frowns at the name of Kelly, and says that 40 casks is a lie.').includes(t)), 'the player\'s own lines in the Transcript license nothing');
check(caught(withEvents([{ kind: 'IntentRejected', reason: 'Mary Kelly is not here' }]), 'She has never heard of Kelly.').includes('Kelly'), 'a selection model\'s miss reason licenses nothing');
check(['She said, "Lestrade was here."', 'She whispered, "Kelly, it was," and looked away.', 'She said, (Lestrade had told her) it was so.'].every(p => !verdict(p).ok),
  'a name opening a quotation or a parenthesis is checked');
check(caught(ctx, 'You find Mr. Lestrade waiting, and Dr. Abberline.').join() === 'Lestrade,Abberline', 'an abbreviation\'s full stop does not hide the name after it');
check(['31', '3', '4'].every(t => caught(ctx, 'She called on the 31st and paid 3s 4d.').includes(t)), 'a number with letters attached is still a number');
check(['ninth', 'third'].every(t => caught(ctx, 'It was the ninth of the month, the third time.').includes(t)), 'spelled ordinals are numbers');
check(caught(ctx, 'A card on the mat reads LESTRADE & SONS.').includes('LESTRADE'), 'a name in capitals is caught');
check(caught(ctx, 'She mentions Müller, a lodger.').includes('Müller'), 'a name with a non-ASCII letter is caught');
const waited = withEvents([{ kind: 'TickResolved', minutes: 15, draw: 0.5, rule: null }, { kind: 'ClockAdvanced', minutes: 15 }]);
check(gateNarration(waited, { prose: 'The clock ticks on, and fifteen minutes crawl by.', observations: [] }).ok, 'the minutes a turn took may be said');
check(verdict('The door to the Study stands shut.').ok && ctx.placesNamed.some(p => p.name === 'The Study'), 'the places this location\'s exits lead to may be named');

// Second engineering review.
check(['Pemberton', 'Kelly'].every(t => caught(ctx, '"Who is it?" Pemberton asked from the door. "Go!" Kelly cried.').includes(t)), 'a name attributing dialogue after ?" or !" is checked');
check(caught(ctx, 'It was signed J. Lestrade, and below it MR. Abberline.').join() === 'Lestrade,Abberline', 'an initial or a capitalised title does not hide the name after it');
check(['nine', 'five'].every(t => caught(ctx, 'She had nine keys, and paid five shillings for them.').includes(t)), 'the clock\'s numbers are licensed only as a time, not as a count');
check(caught(ctx, 'It happened on the twenty-first of August.').includes('twenty'), '…so "twenty" from 20:35 does not license "the twenty-first"');
check(caught(waited, 'She had fifteen keys.').includes('fifteen') && gateNarration(waited, { prose: 'Fifteen minutes crawl by.', observations: [] }).ok, 'elapsed minutes likewise: "fifteen minutes" yes, "fifteen keys" no');
check(findInventions('Pemberton nods to you.', ctx, { strict: true }).some(i => i.token === 'Pemberton') && findInventions('Pemberton nods to you.', ctx).length === 0,
  'strict mode checks a sentence\'s first word too (for Observations and salvaged sentences)');
const remembered = { ...ctx, transcript: [{ person: 'housekeeper', lines: [{ speaker: 'person' as const, text: 'The hall is dark. Lestrade watches you from the stairs.' }] }] };
check(caught(remembered, 'The housekeeper glances at Lestrade, who says nothing.').includes('Lestrade'), 'the narrator\'s own earlier prose licenses nothing, so a slip does not become a licence');
check(gateNarration({ ...ctx, lexicon: [...ctx.lexicon, 'George'] }, { prose: 'A portrait of George III hangs by the stairs.', observations: [] }).ok, 'a Roman numeral in capitals is not a name');

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
