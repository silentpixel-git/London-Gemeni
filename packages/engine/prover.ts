// The reachability prover (plan §2.7): breadth-first search over the REAL
// engine, so there is one set of semantics, with the clock abstracted to its
// period and randomness branched over every eligible Rule. Reports, for every
// act, Clue and ending, the shortest action path or UNREACHABLE.
import type { Id, Selection, Story, Verb } from '../schema';
import { candidates } from './candidates';
import { MINUTES, TICK_MINUTES, resolveTurn, tick } from './engine';
import { fixedRng } from './rng';
import { eligibleTickRules } from './rules';
import { currentPeriod, initialState, inventory, visibleObjects, type State } from './state';
import { minutesUntil } from './time';

export interface ProofGoal { kind: 'act' | 'clue' | 'ending'; id: string }
export interface ProofLine { goal: ProofGoal; reachable: boolean; path?: string[] }
export interface ProofReport { lines: ProofLine[]; explored: number; capped: boolean; ok: boolean }

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

  const start = initialState(story, 1);
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
  return { lines, explored, capped, ok: lines.every(l => l.reachable) && !capped };
}

/** Everything the player could do here that could matter for reachability. */
function actionsFrom(story: Story, s: State): Action[] {
  const c = candidates(story, s);
  const acts: Action[] = [];
  const intent = (label: string, sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>): Action => ({
    label,
    run: st => resolveTurn(story, st, { text: label, selection: { kind: 'intent', ...sel } }, fixedRng([0])).state,
  });
  const listens = (verb: Verb) => story.rules.some(r => r.trigger.kind === 'action' && r.trigger.verb.includes(verb));
  const carried = inventory(s);
  const here = visibleObjects(s, s.location);
  const reachable = [...here, ...carried];
  const obj = (id: Id) => story.objects.find(o => o.id === id)!;

  for (const x of c.exits) acts.push(intent(`move ${x.id}`, { verb: 'move', exit: x.id }));
  for (const id of here) if (obj(id).item) acts.push(intent(`take ${id}`, { verb: 'take', target: id }));
  for (const id of reachable) {
    const o = s.objects[id];
    if (o.container && o.container.state !== 'open') acts.push(intent(`open ${id}`, { verb: 'open', target: id }));
    if (o.container && o.container.state === 'open' && listens('close')) acts.push(intent(`close ${id}`, { verb: 'close', target: id }));
    if (obj(id).document || obj(id).fact) acts.push(intent(`read ${id}`, { verb: 'read', target: id }));
    if (listens('examine')) acts.push(intent(`examine ${id}`, { verb: 'examine', target: id }));
    if (listens('use')) acts.push(intent(`use ${id}`, { verb: 'use', target: id }));
  }
  if (listens('drop')) for (const id of carried) acts.push(intent(`drop ${id}`, { verb: 'drop', target: id }));
  for (const t of c.topics) acts.push(intent(`ask ${t.person} about ${t.fact}`, { verb: 'ask', person: t.person, topic: t.fact }));
  if (listens('talk')) for (const p of c.persons) acts.push(intent(`talk ${p.id}`, { verb: 'talk', person: p.id }));
  for (const id of carried) {
    if (!obj(id).fact && !listens('show') && !listens('give')) continue;
    for (const p of c.persons) {
      acts.push(intent(`show ${id} to ${p.id}`, { verb: 'show', target: id, person: p.id }));
      if (listens('give')) acts.push(intent(`give ${id} to ${p.id}`, { verb: 'give', target: id, person: p.id }));
    }
  }
  for (const r of story.rules) {
    if (r.trigger.kind === 'combine') {
      const [a, b] = r.trigger.items;
      if (reachable.includes(a) && reachable.includes(b)) acts.push(intent(`combine ${a} ${b}`, { verb: 'combine', target: a, secondary: b }));
    }
    if (r.trigger.kind === 'deduction') {
      const facts = r.trigger.facts ?? [];
      if (!facts.every(f => s.knows.player?.[f])) continue;
      acts.push(intent(`deduce ${[...facts, r.trigger.suspect ?? ''].filter(Boolean).join(' ')}`, { verb: 'deduce', facts, person: r.trigger.suspect }));
    }
  }
  // Time: a plain Tick per eligible Rule outcome, and a wait until each pending clock Rule.
  const waits: Array<{ label: string; minutes: number }> = [{ label: 'tick', minutes: TICK_MINUTES }, { label: 'wait', minutes: MINUTES.wait }];
  for (const r of story.rules) {
    if (r.trigger.kind !== 'clock') continue;
    if (r.trigger.act && !r.trigger.act.includes(s.act)) continue;
    if (r.once && (s.firedRules[r.id] ?? 0) > 0) continue;
    waits.push({ label: `wait until ${r.trigger.atMinutes}`, minutes: minutesUntil(s.clock, r.trigger.atMinutes) });
  }
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

/** The State with the clock reduced to its period and the transcript dropped. */
function abstractKey(story: Story, s: State): string {
  const onceRules = Object.keys(s.firedRules).filter(id => story.rules.find(r => r.id === id)?.once);
  return JSON.stringify({
    act: s.act, location: s.location, period: currentPeriod(s), ended: s.ended,
    flags: Object.keys(s.flags).sort(),
    objects: Object.entries(s.objects).map(([id, o]) => [id, o.placement, o.hidden, o.container?.state ?? null]),
    exitLocks: s.exitLocks,
    persons: Object.entries(s.persons).map(([id, p]) => [id, p.override ?? '-', p.disposition, p.introduced]),
    knows: Object.entries(s.knows).map(([who, f]) => [who, Object.keys(f).sort()]),
    clues: [...s.clues].sort(),
    once: onceRules.sort(),
    pending: s.pendingGrants.map(g => `${g.person}:${g.fact}`).sort(),
  });
}

export function formatProof(r: ProofReport): string {
  const lines = r.lines.map(l => l.reachable
    ? `  REACHABLE   ${l.goal.kind} ${l.goal.id}  (${l.path!.length} moves): ${l.path!.join(' → ') || '(start)'}`
    : `  UNREACHABLE ${l.goal.kind} ${l.goal.id}`);
  return [`explored ${r.explored} states${r.capped ? ' (CAPPED — result incomplete)' : ''}`, ...lines].join('\n');
}
