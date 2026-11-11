/**
 * scripts/qa-prove.ts — the reachability prover over the toy Story.
 *
 *   fixtures/toy         every act, Clue and ending must be REACHABLE
 *   fixtures/unsolvable  the toy with the study key removed: act 1, clue_letter, solved and
 *                        unsolved must be UNREACHABLE; accused_wrongly must stay REACHABLE
 *   fixtures/stress      the 3-act, 6-room, 33-Rule stress Story: every goal REACHABLE, search not capped
 *   stories/whitechapel_1888  the real Story: every Clue and ending REACHABLE, uncapped, no EARLY
 *   variants             what ADR-0005 pins for the prover: it can wait to a later period, it
 *                        proves only Selections the endpoint accepts, examine reaches people,
 *                        and early learning is reported
 *
 * Run: npx tsx scripts/qa-prove.ts     Exit 1 on any unexpected outcome.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Story } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { formatProof, prove } from '../packages/engine/prover';

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string) => { console.error(`[FAIL] ${l}`); fails++; };
const load = (name: string) => Story.parse(loadStoryDir(join('packages', 'schema', 'fixtures', name)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stressVariant = (mutate: (raw: any) => void) => { const raw = structuredClone(loadStoryDir(join('packages', 'schema', 'fixtures', 'stress'))); mutate(raw); return Story.parse(raw); };

{
  const r = prove(load('toy'));
  console.log(formatProof(r));
  if (r.ok) pass('toy: every act, clue and ending reachable'); else fail('toy: something unreachable or search capped');
}
{
  const r = prove(load('unsolvable'));
  console.log(formatProof(r));
  const by = Object.fromEntries(r.lines.map(l => [`${l.goal.kind}:${l.goal.id}`, l.reachable]));
  const expectUnreachable = ['act:1', 'clue:clue_letter', 'ending:solved', 'ending:unsolved'];
  for (const k of expectUnreachable) if (by[k] === false) pass(`unsolvable: ${k} UNREACHABLE`); else fail(`unsolvable: ${k} should be UNREACHABLE`);
  if (by['ending:accused_wrongly']) pass('unsolvable: accused_wrongly still reachable'); else fail('unsolvable: accused_wrongly should be reachable');
  if (by['clue:clue_key']) pass('unsolvable: clue_key still reachable'); else fail('unsolvable: clue_key should be reachable');
  if (r.capped) fail('unsolvable: search capped');
}
{
  const r = prove(load('stress'));
  console.log(formatProof(r));
  const unreachable = r.lines.filter(l => !l.reachable).map(l => `${l.goal.kind}:${l.goal.id}`);
  if (r.capped) fail(`stress: search capped after ${r.explored} states`);
  else if (unreachable.length) fail(`stress: UNREACHABLE ${unreachable.join(', ')}`);
  else pass(`stress: every act, clue and ending reachable (${r.explored} states explored)`);
}
{
  const r = prove(load('stress'));
  const early = r.early.map(e => e.fact).sort().join();
  if (early === 'crane_found_at_lamp,oil_watered') pass('stress: EARLY reports the two Facts read from documents before their act');
  else fail(`stress: EARLY should be crane_found_at_lamp,oil_watered, got ${early}`);
  const wrong = r.lines.find(l => l.goal.id === 'wrong_accusation')?.path ?? [];
  if (wrong[0] === 'move to_kitchen' && wrong.at(-1) === 'deduce maud') pass('stress: an accusation needs the suspect met first (move to_kitchen → deduce maud)');
  else fail(`stress: wrong_accusation path should meet Maud first, got ${wrong.join(' → ')}`);
}
{
  // A cellar off the toy's hall opens only in the small hours (23:00); act 0 starts at 20:30, and
  // with the midnight bells removed no clock Rule gives the prover a time to wait for.
  const raw = structuredClone(loadStoryDir(join('packages', 'schema', 'fixtures', 'toy'))) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  raw.locations.find((l: { id: string }) => l.id === 'hall').exits.push({ id: 'cellar_stairs', names: ['down', 'cellar'], to: 'cellar' });
  raw.locations.push({ id: 'cellar', name: 'The Cellar', beats: ['Damp stone and racks of empty bottles.'], exits: [{ id: 'cellar_up', names: ['up'], to: 'hall' }], openPeriods: ['late_night'] });
  raw.facts.push({ id: 'cellar_fact', statement: 'Someone has been sleeping in the cellar.', knownBy: [], visibleFromAct: 0, topics: ['the cellar'] });
  raw.clues.push({ id: 'clue_cellar', name: 'A Bed of Sacks', fact: 'cellar_fact', summary: 'Someone has been sleeping in the cellar.' });
  raw.rules = raw.rules.filter((r: { id: string }) => r.id !== 'midnight_bells');
  raw.rules.push({ id: 'cellar_found', trigger: { kind: 'enter', location: 'cellar' }, when: { act: [0] }, once: true, effects: [{ kind: 'grantFact', person: 'player', fact: 'cellar_fact' }] });
  const r = prove(Story.parse(raw));
  const line = r.lines.find(l => l.goal.id === 'clue_cellar')!;
  if (line.reachable && !r.capped && line.path!.some(step => step.startsWith('wait until late_night'))) pass(`variant: a room open only later in the day is reached by waiting (${line.path!.join(' → ')})`);
  else fail(`variant: clue_cellar should be REACHABLE by waiting until late_night — ${formatProof(r).split('\n').find(l => l.includes('clue_cellar'))}`);
}
{
  const v = stressVariant(raw => {
    raw.facts.push({ id: 'orrin_hands', statement: "Orrin's hands are tarred.", knownBy: [], visibleFromAct: 0, topics: ['his hands'] });
    raw.clues.push({ id: 'clue_hands', name: 'Tarred Hands', fact: 'orrin_hands', summary: 'The boatman has handled fresh tar.' });
    raw.rules.push({ id: 'look_at_orrin', trigger: { kind: 'action', verb: ['examine'], target: ['orrin'] }, once: true, effects: [{ kind: 'grantFact', person: 'player', fact: 'orrin_hands' }] });
  });
  const line = prove(v).lines.find(l => l.goal.id === 'clue_hands')!;
  if (line.reachable && line.path!.join() === 'examine orrin') pass('variant: a Rule on examining a person is REACHABLE (examine orrin)');
  else fail(`variant: clue_hands should be reached by examine orrin, got ${line.reachable ? line.path!.join(' → ') : 'UNREACHABLE'}`);
}
{
  // The real Story (Act 0, docs/act0-mechanical-score.md §11): its goals, uncapped, with no early learning.
  const dir = join('stories', 'whitechapel_1888');
  if (!existsSync(join(dir, 'story.json'))) fail('whitechapel_1888: the Story is not authored yet');
  else {
    const r = prove(Story.parse(loadStoryDir(dir)));
    console.log(formatProof(r));
    const want = ['ending:wager_won', 'ending:wager_lost', 'clue:clue_old_soldier', 'clue:clue_actor', 'clue:clue_wager_won', 'clue:clue_wager_lost', 'clue:clue_what_asks'];
    const by = Object.fromEntries(r.lines.map(l => [`${l.goal.kind}:${l.goal.id}`, l.reachable]));
    const missing = want.filter(k => !by[k]);
    if (r.capped) fail(`whitechapel_1888: search capped after ${r.explored} states`);
    else if (missing.length) fail(`whitechapel_1888: UNREACHABLE ${missing.join(', ')}`);
    else pass(`whitechapel_1888: every Clue and ending of Act 0 reachable (${r.explored} states explored)`);
    if (r.early.length) fail(`whitechapel_1888: EARLY ${r.early.map(e => e.fact).join(', ')}`);
  }
}
console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
