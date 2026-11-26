/**
 * scripts/qa-gate.ts — self-test of the invention gate against a real toy turn.
 * Known inventions must be caught; the authored beats, the Story's lexicon and
 * the narrator's own name must pass. Run: npx tsx scripts/qa-gate.ts
 */
import { join } from 'node:path';
import { Story, type NarrationContext, type Selection } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { buildNarrationContext, initialState, resolveTurn, startInvestigation, tick, type State } from '../packages/engine';
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

check(!verdict('It had been ten days since the light failed.').ok, 'a spelled number is matched whole: "ten" is not earned by a context word that contains it',
  JSON.stringify(verdict('It had been ten days since the light failed.')));

// An id is not a name, though it can be the real one. The stress Story's woman in oilskins, Ines Tarrow, is
// named once her keeper's log is read; her id was "ines" when the narrator first gave her name away. The
// validator now fails such an id (qa:story), but the gate must not lean on that: the reported turn is
// replayed with her old id. Only the context's words license a name: labels, Story text, the player's own line.
{
  const raw = JSON.stringify(loadStoryDir(join('packages', 'schema', 'fixtures', 'stress')));
  const stress = Story.parse(JSON.parse(raw.replaceAll('"oilskin_woman"', '"ines"')));
  const go = (s: State, text: string, sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>) =>
    resolveTurn(stress, s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([0]));
  const gate = (c: NarrationContext, prose: string) => gateNarration(c, { prose, observations: [] });
  const arrive = go(startInvestigation(stress, 1).state, 'go to the kitchen', { verb: 'move', exit: 'to_kitchen' });
  const kitchen = arrive.state;
  const talk = go(kitchen, 'talk to the woman in oilskins', { verb: 'talk', person: 'ines' });
  const kctx = buildNarrationContext(stress, talk.state, talk.events, 'compact');
  check(kctx.events.some(e => e.kind === 'Spoke' && e.person === 'ines') && kctx.personsPresent.some(p => p.id === 'ines' && p.label === 'the woman in oilskins'),
    'stress kitchen: she is addressed by her id and labelled by her alias');
  const named = gate(kctx, 'I turned to the woman in yellow oilskins, Ines, who did not look up.');
  check(!named.ok && named.inventions.some(i => i.token === 'Ines'), "an un-introduced person's id-derived name is caught", JSON.stringify(named));
  const lines = gate({ ...kctx, observations: [{ key: 'coiled_lines', subject: 'kitchen', text: 'Coiled lines hang by the door.' }] }, 'I turned to her, Ines, and waited.');
  check(!lines.ok, 'a name is matched whole: "Ines" is not earned by a context word that contains it', JSON.stringify(lines));
  check(gate(kctx, 'I turned to the woman in oilskins while Maud Pike watched us both.').ok, 'her label and a present person\'s name pass');
  // The player may echo a name they typed, wherever they learned it: it tells them nothing they did not write.
  const typed = go(kitchen, 'talk to Ines', { verb: 'talk', person: 'ines' });
  check(gate(buildNarrationContext(stress, typed.state, typed.events, 'compact'), 'She looked up sharply when I said Ines.').ok, 'a name the player typed this turn passes');
  const read = go(kitchen, 'read the log', { verb: 'read', target: 'keeper_log' });
  const after = go(read.state, 'talk to the woman in oilskins', { verb: 'talk', person: 'ines' });
  check(gate(buildNarrationContext(stress, after.state, after.events, 'compact'), 'I turned to Ines, who did not look up.').ok, 'once her log is read, her name passes');

  // Places the player has been shown reach the narrator by name, so a name the id alone used to license still passes.
  const back = go(kitchen, 'go back to the jetty', { verb: 'move', exit: 'to_jetty' });
  const bctx = buildNarrationContext(stress, back.state, back.events, 'full');
  const left = 'I left the Keepers\' Kitchen and went down to the jetty.';
  check(gate(bctx, left).ok && !gate({ ...bctx, placesNamed: [] }, left).ok,
    'the place just left passes by its name in placesNamed, not by its id', JSON.stringify(bctx.placesNamed));
  const barred = go(kitchen, 'go up the tower', { verb: 'move', exit: 'to_tower' });
  check(barred.events.some(e => e.kind === 'MoveBlocked') && gate(buildNarrationContext(stress, barred.state, barred.events, 'full'), 'The way up to the Tower Stair is barred.').ok,
    'where a blocked way leads passes by its name');
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
