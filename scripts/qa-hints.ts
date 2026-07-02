/**
 * scripts/qa-hints.ts
 * Deterministic QA for the Watson hint selector. No AI, no browser, no Supabase.
 * Run: npx tsx scripts/qa-hints.ts   (exit code 1 on any FAIL)
 */
import { OBJECTIVES, selectHint, HintState } from '../engine/stories/whitechapel-1888/hints';
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';

let passes = 0, fails = 0;
function pass(l: string) { console.log(`[PASS] ${l}`); passes++; }
function fail(l: string, d?: string) { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; }

function state(p: Partial<HintState>): HintState {
  return { currentAct: 0, location: '', flags: {}, inventory: [], npcStates: {}, locationVisitCounts: {}, ...p };
}

const SENTINEL = '__advance_via_correct_deduction_only__';

// 1) Drift guard: every real gate flag is covered by an objective whose `done`
//    flips true when only that flag (or its inventory equivalent) is set.
for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
  const act = Number(actStr);
  for (const f of cond.requireFlags) {
    if (f === SENTINEL) continue;
    const s = state({ currentAct: act, flags: { [f]: true } });
    const covered = OBJECTIVES.some(o => o.act === act && o.done(s));
    covered ? pass(`gate covered: act ${act} ${f}`)
            : fail(`gate NOT covered by any objective`, `act ${act} ${f}`);
  }
}

// 2) Act 0 prerequisite chain: clipping not yet in hand → examine pile, not show.
{
  const before = state({ currentAct: 0, location: 'baker_street',
    npcStates: { holmes: { currentLocation: 'baker_street', status: 'alive' } } });
  const pool = OBJECTIVES.filter(o => o.act === 0 && !o.done(before) && o.available(before));
  const ids = pool.map(o => o.id);
  ids.includes('a0_newspile_examine') && !ids.includes('a0_newspile_show')
    ? pass('act0: examine-pile available, show-clipping not (no clipping yet)')
    : fail('act0 prereq gating wrong', ids.join(','));

  const after = state({ currentAct: 0, location: 'baker_street',
    inventory: ['Newspaper Clipping (the "Dear Boss" letter)'],
    flags: { examined_baker_street_newspaper_pile: true },
    npcStates: { holmes: { currentLocation: 'baker_street', status: 'alive' } } });
  const ids2 = OBJECTIVES.filter(o => o.act === 0 && !o.done(after) && o.available(after)).map(o => o.id);
  ids2.includes('a0_newspile_show') && !ids2.includes('a0_newspile_examine')
    ? pass('act0: with clipping in hand, show-clipping available, examine done')
    : fail('act0 show gating wrong', ids2.join(','));
}

// 3) Locked location: Act 6 asylum unavailable until asylum_unlocked.
{
  const locked = state({ currentAct: 6, location: 'bond_office' });
  const a = OBJECTIVES.find(o => o.id === 'a6_records')!;
  !a.available(locked) ? pass('act6: asylum locked without asylum_unlocked')
                       : fail('act6 asylum should be locked');
  const unlocked = state({ currentAct: 6, location: 'bond_office', flags: { asylum_unlocked: true } });
  a.available(unlocked) ? pass('act6: asylum reachable with asylum_unlocked')
                        : fail('act6 asylum should be reachable');
}

// 4) selectHint never returns a done/unavailable step; returns FALLBACK when empty.
{
  const allDone = state({ currentAct: 2, location: 'whitechapel_mortuary', flags: {
    examined_whitechapel_mortuary: true, examined_bucks_row: true, examined_hanbury_street: true,
    talked_to_tumblety_at_h_division_station: true, talked_to_holmes_at_h_division_station: true } });
  const t = selectHint(allDone);
  t.verb === 'reflect' ? pass('empty pool → reflect fallback')
                       : fail('expected reflect fallback', t.verb);

  const partial = state({ currentAct: 1, location: 'millers_court',
    flags: { examined_millers_court_burned_clothing: true } });
  const tgt = selectHint(partial);
  const match = OBJECTIVES.find(o => o.act === 1 && o.subject === tgt.subject);
  (tgt.verb === 'reflect') || (match && !match.done(partial) && match.available(partial))
    ? pass('selectHint returns an open, available step')
    : fail('selectHint returned a done/unavailable step', tgt.subject);
}

// 5) Local-first tiering: an available local step is preferred over remote ones.
{
  const s = state({ currentAct: 2, location: 'bucks_row' });
  // bucks_row examine is local & available; mortuary/hanbury are remote but reachable.
  let localHits = 0;
  for (let i = 0; i < 20; i++) if (selectHint(s).subject.includes('Buck')) localHits++;
  localHits === 20 ? pass('local-first: always picks the current-location step when available')
                   : fail('local-first tiering failed', `${localHits}/20`);
}

// 6) Unvisited-location guard: a hint must never name a location's contents before
//    Watson has been there. Act 1 at Dorset Street with Hutchinson already spoken to →
//    the only steps left are inside Miller's Court, which has NOT been visited.
{
  const s = state({ currentAct: 1, location: 'dorset_street',
    flags: { talked_to_hutchinson_at_dorset_street: true },
    npcStates: { bond: { currentLocation: 'millers_court', status: 'alive' } } });
  let leaks = 0;
  for (let i = 0; i < 30; i++) {
    const t = selectHint(s);
    // Every remaining step is in unvisited Miller's Court → must be a 'travel' nudge
    // with no interior subject, pointing only at the location.
    if (t.verb !== 'travel' || t.subject !== '' || t.locationKnown !== false) leaks++;
    if (t.verb === 'travel' && !t.locationName.includes("Miller")) leaks++;
  }
  leaks === 0 ? pass("unvisited location → travel nudge, no interior subject leaked")
              : fail('unvisited location leaked interior detail', `${leaks}/30 bad targets`);
}

// 7) Once visited, the interior subject is allowed again.
{
  const s = state({ currentAct: 1, location: 'dorset_street',
    flags: { talked_to_hutchinson_at_dorset_street: true },
    locationVisitCounts: { millers_court: 1 } });
  const t = selectHint(s);
  (t.verb !== 'travel' && t.locationKnown === true && t.subject.length > 0)
    ? pass('previously-visited location → interior subject restored')
    : fail('visited location should expose subject', JSON.stringify(t));
}

// 8) Every objective's optional `flag` — where present — matches a real gate
//    flag for that act, and no two objectives in the same act share one.
{
  const seenPerAct = new Map<number, Set<string>>();
  let bad = 0;
  for (const o of OBJECTIVES) {
    if (!o.flag) continue;
    const gate = ACT_PROGRESSION[o.act];
    if (!gate || !gate.requireFlags.includes(o.flag)) {
      fail(`objective ${o.id} has flag "${o.flag}" not in ACT_PROGRESSION[${o.act}].requireFlags`);
      bad++;
      continue;
    }
    const seen = seenPerAct.get(o.act) ?? new Set<string>();
    if (seen.has(o.flag)) {
      fail(`duplicate flag "${o.flag}" tagged on two objectives in act ${o.act}`);
      bad++;
    }
    seen.add(o.flag);
    seenPerAct.set(o.act, seen);
  }
  bad === 0 && pass('every tagged objective.flag matches a real, unique gate flag for its act');
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
