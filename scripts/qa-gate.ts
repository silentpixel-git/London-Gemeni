/**
 * scripts/qa-gate.ts — self-test of the invention gate against a real toy turn.
 * Known inventions must be caught; the authored beats, the Story's lexicon and
 * the narrator's own name must pass. Run: npx tsx scripts/qa-gate.ts
 */
import { join } from 'node:path';
import { Story } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { buildNarrationContext, initialState, resolveTurn, tick } from '../packages/engine';
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

// A Tick's Events carry the engine's own numbers (the draw, the minutes); they license nothing.
{
  const t = tick(story, s0, 15, fixedRng([0.7312958]));
  const tctx = buildNarrationContext(story, t.state, t.events, 'compact');
  const v = gateNarration(tctx, { prose: 'The carrier said 29 barrels came in, at 12 past the hour, some 15 minutes ago.', observations: [] });
  check(['29', '12', '15'].every(n => v.inventions.some(i => i.token === n)), 'numbers are not licensed by a Tick\'s draw or minutes', JSON.stringify(v.inventions));
  const part = gateNarration({ ...tctx, beats: ['The ledger shows 1290 sacks.'] }, { prose: 'The ledger shows 1290 sacks; 29 were spoiled.', observations: [] });
  check(part.inventions.length === 1 && part.inventions[0].token === '29', 'a number is matched whole, not as part of a longer one', JSON.stringify(part.inventions));
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
