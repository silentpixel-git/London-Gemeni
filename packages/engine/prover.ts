// The reachability prover (plan §2.7): breadth-first search over the REAL
// engine, so there is one set of semantics, with the clock abstracted to its
// period and randomness branched over every eligible Rule. Reports, for every
// act, Clue and ending, the shortest action path or UNREACHABLE.
//
// It proves only what a player can do (ADR-0005): every action is a Selection
// the endpoint would accept against that moment's Candidate Set, the search
// starts from the opening turn the server plays, and time can always be
// waited to the next period. "wait until X" in a path stands for as many
// waits as it takes. It also reports, as EARLY, the first path it meets on
// which the player comes to know a Fact before its visibleFromAct. The search
// stops once every goal is found, so EARLY is a net, not a proof of absence.
import { inCandidateSet, type Id, type Selection, type Story, type Verb } from '../schema/index.js';
import { candidates } from './candidates.js';
import { MINUTES, TICK_MINUTES, resolveTurn, startInvestigation, tick } from './engine.js';
import { fixedRng } from './rng.js';
import { eligibleTickRules } from './rules.js';
import { currentPeriod, inventory, visibleObjects, type State } from './state.js';
import { minutesUntil } from './time.js';

export interface ProofGoal { kind: 'act' | 'clue' | 'ending'; id: string }
export interface ProofLine { goal: ProofGoal; reachable: boolean; path?: string[] }
/** The player came to know a Fact in an act before the one it is visible from. A warning, not a failure. */
export interface EarlyFact { fact: Id; act: number; visibleFromAct: number; path: string[] }
export interface ProofReport { lines: ProofLine[]; early: EarlyFact[]; explored: number; capped: boolean; ok: boolean }

type Action = { label: string; run: (s: State) => State };

export function prove(story: Story, opts: { maxStates?: number } = {}): ProofReport {
  const maxStates = opts.maxStates ?? 20000;
  const goals: ProofGoal[] = [
    ...story.acts.filter(a => a.id !== story.opening.act).map(a => ({ kind: 'act' as const, id: String(a.id) })),
    ...story.clues.map(c => ({ kind: 'clue' as const, id: c.id })),
    ...story.endings.map(e => ({ kind: 'ending' as const, id: e.id })),
  ];
  const found = new Map<string, string[]>();
  const goalKey = (g: ProofGoal) => `${g.kind}:${g.id}`;
  const early = new Map<Id, EarlyFact>();

  const start = startInvestigation(story, 1).state;
  const seen = new Set<string>([abstractKey(story, start)]);
  const queue: Array<{ s: State; path: string[] }> = [{ s: start, path: [] }];
  let explored = 0;
  let capped = false;

  const check = (s: State, path: string[]) => {
    for (const g of goals) {
      const k = goalKey(g);
      if (found.has(k)) continue;
      const hit = g.kind === 'act' ? String(s.act) === g.id
        : g.kind === 'clue' ? s.clues.includes(g.id)
        : s.ended === g.id;
      if (hit) found.set(k, path);
    }
    for (const f of story.facts) {
      if (s.knows.player?.[f.id] && f.visibleFromAct > s.act && !early.has(f.id)) {
        early.set(f.id, { fact: f.id, act: s.act, visibleFromAct: f.visibleFromAct, path });
      }
    }
  };
  check(start, []);

  while (queue.length > 0 && found.size < goals.length) {
    if (explored >= maxStates) { capped = true; break; }
    const { s, path } = queue.shift()!;
    explored++;
    if (s.ended) continue;
    for (const a of actionsFrom(story, s)) {
      let next: State;
      try { next = a.run(s); } catch { continue; }
      const key = abstractKey(story, next);
      if (seen.has(key)) continue;
      seen.add(key);
      const p = [...path, a.label];
      check(next, p);
      queue.push({ s: next, path: p });
    }
  }

  const lines = goals.map(g => {
    const path = found.get(goalKey(g));
    return { goal: g, reachable: !!path, path };
  });
  return { lines, early: [...early.values()], explored, capped, ok: lines.every(l => l.reachable) && !capped };
}

/** Everything the player could do here that could matter for reachability. */
function actionsFrom(story: Story, s: State): Action[] {
  const c = candidates(story, s);
  const acts: Action[] = [];
  // Only Selections the endpoint would accept against this Candidate Set.
  const offer = (label: string, sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>) => {
    const selection: Selection = { kind: 'intent', ...sel };
    if (!inCandidateSet(selection, c)) return;
    acts.push({ label, run: st => resolveTurn(story, st, { text: label, selection }, fixedRng([0])).state });
  };
  const listens = (verb: Verb) => story.rules.some(r => r.trigger.kind === 'action' && r.trigger.verb.includes(verb));
  const carried = inventory(s);
  const here = visibleObjects(s, s.location);
  const reachable = [...here, ...carried];
  const obj = (id: Id) => story.objects.find(o => o.id === id)!;

  for (const x of c.exits) offer(`move ${x.id}`, { verb: 'move', exit: x.id });
  for (const id of here) if (obj(id).item) offer(`take ${id}`, { verb: 'take', target: id });
  for (const id of reachable) {
    const o = s.objects[id];
    if (o.container && o.container.state !== 'open') offer(`open ${id}`, { verb: 'open', target: id });
    if (o.container && o.container.state === 'open' && listens('close')) offer(`close ${id}`, { verb: 'close', target: id });
    if (obj(id).document || obj(id).fact) offer(`read ${id}`, { verb: 'read', target: id });
    if (listens('examine')) offer(`examine ${id}`, { verb: 'examine', target: id });
    if (listens('use')) offer(`use ${id}`, { verb: 'use', target: id });
  }
  // use X on Y, only in the pairs some Rule listens for.
  for (const r of story.rules) {
    if (r.trigger.kind !== 'action' || !r.trigger.verb.includes('use') || !r.trigger.secondary?.length) continue;
    for (const a of r.trigger.target ?? reachable) for (const b of r.trigger.secondary) {
      if (reachable.includes(a) && (reachable.includes(b) || c.persons.some(p => p.id === b))) offer(`use ${a} on ${b}`, { verb: 'use', target: a, secondary: b });
    }
  }
  if (listens('drop')) for (const id of carried) offer(`drop ${id}`, { verb: 'drop', target: id });
  for (const t of c.topics) offer(`ask ${t.person} about ${t.fact}`, { verb: 'ask', person: t.person, topic: t.fact });
  if (listens('talk')) for (const p of c.persons) offer(`talk ${p.id}`, { verb: 'talk', person: p.id });
  if (listens('examine')) for (const p of c.persons) offer(`examine ${p.id}`, { verb: 'examine', target: p.id });
  for (const id of carried) {
    if (!obj(id).fact && !listens('show') && !listens('give')) continue;
    for (const p of c.persons) {
      offer(`show ${id} to ${p.id}`, { verb: 'show', target: id, person: p.id });
      if (listens('give')) offer(`give ${id} to ${p.id}`, { verb: 'give', target: id, person: p.id });
    }
  }
  for (const r of story.rules) {
    if (r.trigger.kind === 'combine') {
      const [a, b] = r.trigger.items;
      if (reachable.includes(a) && reachable.includes(b)) offer(`combine ${a} ${b}`, { verb: 'combine', target: a, secondary: b });
    }
    if (r.trigger.kind === 'deduction') {
      const facts = r.trigger.facts ?? [];
      if (!facts.every(f => s.knows.player?.[f])) continue;
      offer(`deduce ${[...facts, r.trigger.suspect ?? ''].filter(Boolean).join(' ')}`, { verb: 'deduce', facts, person: r.trigger.suspect });
    }
  }
  // Time: a plain Tick per eligible Rule outcome, a wait to the next period (whatever
  // the period gates: a room, a schedule, a delayed grant), and a wait until each
  // pending clock Rule.
  const until = (p: { startMinutes: number }) => minutesUntil(s.clock, p.startMinutes);
  const nextPeriod = story.periods.filter(p => p.id !== currentPeriod(story, s)).reduce((a, b) => (until(b) < until(a) ? b : a));
  const waits: Array<{ label: string; minutes: number }> = [{ label: 'tick', minutes: TICK_MINUTES }, { label: 'wait', minutes: MINUTES.wait }];
  for (const r of story.rules) {
    if (r.trigger.kind !== 'clock') continue;
    if (r.trigger.act && !r.trigger.act.includes(s.act)) continue;
    if (r.once && (s.firedRules[r.id] ?? 0) > 0) continue;
    waits.push({ label: `wait until ${r.trigger.atMinutes}`, minutes: minutesUntil(s.clock, r.trigger.atMinutes) });
  }
  waits.push({ label: `wait until ${nextPeriod.id}`, minutes: until(nextPeriod) });
  const eligible = eligibleTickRules(story, s);
  const draws = eligible.length === 0 ? [0] : drawsSelectingEach(eligible.map(r => r.weight ?? 1));
  for (const w of waits) for (const [i, d] of draws.entries()) {
    const label = eligible.length ? `${w.label} (${eligible[i].id})` : w.label;
    acts.push({ label, run: st => tick(story, st, w.minutes, fixedRng([d])).state });
  }
  return acts;
}

/** One draw in [0,1) that makes chooseByWeight pick each index in turn. */
function drawsSelectingEach(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map(w => { const lo = acc / total; acc += w; return (lo + acc / total) / 2; });
}

/**
 * The Facts whose knowledge can change what is reachable: those a Clue is
 * found by, a Rule condition (`factsKnown`) reads, a `disclosed` trigger names,
 * or a deduction needs. Knowing any other Fact (a flavour answer, a rumour no
 * Rule listens for) changes only what may be said, so two States that differ
 * only in such knowledge are the same for the search. null means every Fact
 * counts, as when some `disclosed` trigger names no Fact.
 */
const relevantFactsOf = new WeakMap<Story, Set<Id> | null>();
function relevantFacts(story: Story): Set<Id> | null {
  if (relevantFactsOf.has(story)) return relevantFactsOf.get(story)!;
  let out: Set<Id> | null = new Set(story.clues.map(c => c.fact));
  for (const r of story.rules) {
    for (const f of r.when?.factsKnown ?? []) out.add(f);
    if (r.trigger.kind === 'disclosed') {
      if (!r.trigger.fact) { out = null; break; }
      out.add(r.trigger.fact);
    }
    if (r.trigger.kind === 'deduction') for (const f of r.trigger.facts ?? []) out.add(f);
  }
  relevantFactsOf.set(story, out);
  return out;
}

/** The State with the clock reduced to its period, the transcript dropped, and knowledge of irrelevant Facts left out. */
function abstractKey(story: Story, s: State): string {
  const relevant = relevantFacts(story);
  const known = (f: Record<Id, true>) => Object.keys(f).filter(id => !relevant || relevant.has(id)).sort();
  const onceRules = Object.keys(s.firedRules).filter(id => story.rules.find(r => r.id === id)?.once);
  return JSON.stringify({
    act: s.act, location: s.location, period: currentPeriod(story, s), ended: s.ended,
    flags: Object.keys(s.flags).sort(),
    objects: Object.entries(s.objects).map(([id, o]) => [id, o.placement, o.hidden, o.container?.state ?? null]),
    exitLocks: s.exitLocks,
    persons: Object.entries(s.persons).map(([id, p]) => [id, p.override ?? '-', p.disposition, p.introduced]),
    met: Object.keys(s.met).sort(),
    knows: Object.entries(s.knows).map(([who, f]) => [who, known(f)]),
    clues: [...s.clues].sort(),
    once: onceRules.sort(),
    pending: s.pendingGrants.map(g => `${g.person}:${g.fact}`).sort(),
  });
}

export function formatProof(r: ProofReport): string {
  const lines = r.lines.map(l => l.reachable
    ? `  REACHABLE   ${l.goal.kind} ${l.goal.id}  (${l.path!.length} moves): ${l.path!.join(' → ') || '(start)'}`
    : `  UNREACHABLE ${l.goal.kind} ${l.goal.id}`);
  const early = r.early.map(e => `  EARLY       fact ${e.fact} known in act ${e.act}, visible from act ${e.visibleFromAct} (${e.path.length} moves): ${e.path.join(' → ') || '(start)'}`);
  return [`explored ${r.explored} states${r.capped ? ' (CAPPED — result incomplete)' : ''}`, ...lines, ...early].join('\n');
}
