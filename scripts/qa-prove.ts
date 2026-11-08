/**
 * scripts/qa-prove.ts — the reachability prover over the toy Story.
 *
 *   fixtures/toy         every act, Clue and ending must be REACHABLE
 *   fixtures/unsolvable  the toy with the study key removed: act 1, clue_letter, solved and
 *                        unsolved must be UNREACHABLE; accused_wrongly must stay REACHABLE
 *   fixtures/stress      the 3-act, 6-room, 33-Rule stress Story: every goal REACHABLE, search not capped
 *
 * Run: npx tsx scripts/qa-prove.ts     Exit 1 on any unexpected outcome.
 */
import { join } from 'node:path';
import { Story } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { formatProof, prove } from '../packages/engine/prover';

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string) => { console.error(`[FAIL] ${l}`); fails++; };
const load = (name: string) => Story.parse(loadStoryDir(join('packages', 'schema', 'fixtures', name)));

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
console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
