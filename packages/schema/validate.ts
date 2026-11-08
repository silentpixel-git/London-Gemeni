// Story validation: the Zod shape check followed by the referential-integrity
// checks that need no engine. The reachability prover (plan §2.7) is Phase 1
// and will be added here as a further pass.
//
// FAIL = the Story cannot be built. WARN = suspicious, review by hand.
import { Conditions, Id, Lock, Placement } from './common.js';
import { Effect, Rule, Trigger } from './rule.js';
import { Story } from './story.js';

export interface Issue {
  level: 'fail' | 'warn';
  /** Where the problem is, e.g. "rules/open_study_door/effects[0]". */
  at: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  story?: Story;
  issues: Issue[];
}

export function validateStory(raw: unknown): ValidationResult {
  const parsed = Story.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(i => ({
        level: 'fail' as const,
        at: i.path.length ? i.path.join('/') : '(root)',
        message: i.message,
      })),
    };
  }
  const story = parsed.data;
  const issues: Issue[] = [];
  const fail = (at: string, message: string) => issues.push({ level: 'fail', at, message });
  const warn = (at: string, message: string) => issues.push({ level: 'warn', at, message });

  // ── Identity tables ──────────────────────────────────────────────────────
  const acts = new Set(story.acts.map(a => a.id));
  const locations = new Map(story.locations.map(l => [l.id, l]));
  const objects = new Map(story.objects.map(o => [o.id, o]));
  const persons = new Map(story.persons.map(p => [p.id, p]));
  const facts = new Map(story.facts.map(f => [f.id, f]));
  const clues = new Map(story.clues.map(c => [c.id, c]));
  const endings = new Set(story.endings.map(e => e.id));
  const rules = new Map(story.rules.map(r => [r.id, r]));

  const dup = <T extends { id: string | number }>(items: T[], at: string) => {
    const seen = new Set<string | number>();
    for (const it of items) {
      if (seen.has(it.id)) fail(`${at}/${it.id}`, 'duplicate id');
      seen.add(it.id);
    }
  };
  dup(story.acts, 'acts'); dup(story.locations, 'locations'); dup(story.objects, 'objects');
  dup(story.persons, 'persons'); dup(story.facts, 'facts'); dup(story.clues, 'clues');
  dup(story.rules, 'rules'); dup(story.endings, 'endings');

  const needLocation = (id: Id, at: string) => { if (!locations.has(id)) fail(at, `unknown location "${id}"`); };
  const needObject = (id: Id, at: string) => { if (!objects.has(id)) fail(at, `unknown object "${id}"`); };
  const needPerson = (id: Id, at: string) => { if (id !== 'player' && !persons.has(id)) fail(at, `unknown person "${id}"`); };
  const needFact = (id: Id, at: string) => { if (!facts.has(id)) fail(at, `unknown fact "${id}"`); };
  const needAct = (id: number, at: string) => { if (!acts.has(id)) fail(at, `unknown act ${id}`); };
  const needItem = (id: Id, at: string) => {
    needObject(id, at);
    const o = objects.get(id);
    if (o && !o.item) fail(at, `"${id}" is not an item`);
  };
  const needLock = (lock: Lock, at: string) => {
    if (lock.kind === 'key') needItem(lock.object, `${at}/lock`);
    else flagsRead.add(lock.flag);
  };
  const needPlacement = (p: Placement, at: string) => {
    if (p.kind === 'location') needLocation(p.location, `${at}/placement`);
    if (p.kind === 'person') needPerson(p.person, `${at}/placement`);
    if (p.kind === 'container') {
      needObject(p.container, `${at}/placement`);
      const c = objects.get(p.container);
      if (c && !c.container) fail(`${at}/placement`, `"${p.container}" is not a container`);
    }
  };

  const flagsSet = new Map<string, string[]>();   // flag → where set
  const flagsRead = new Set<string>();

  // ── Periods and weathers ─────────────────────────────────────────────────
  const periods = new Set(story.periods.map(p => p.id));
  const weathers = new Set(story.weathers.map(w => w.id));
  dup(story.periods, 'periods'); dup(story.weathers, 'weathers');
  for (let i = 1; i < story.periods.length; i++) {
    if (story.periods[i].startMinutes <= story.periods[i - 1].startMinutes) fail(`periods/${story.periods[i].id}`, 'periods must be in ascending clock order');
  }
  const needPeriod = (id: Id, at: string) => { if (!periods.has(id)) fail(at, `unknown period "${id}"`); };
  const needWeather = (id: Id, at: string) => { if (!weathers.has(id)) fail(at, `unknown weather "${id}"`); };

  // ── Acts and opening ─────────────────────────────────────────────────────
  for (const act of story.acts) { needLocation(act.anchorLocation, `acts/${act.id}/anchorLocation`); needWeather(act.weather, `acts/${act.id}/weather`); }
  needAct(story.opening.act, 'opening/act');
  needLocation(story.opening.location, 'opening/location');
  const firstAct = Math.min(...story.acts.map(a => a.id));
  if (story.opening.act !== firstAct) warn('opening/act', `opening act ${story.opening.act} is not the lowest act ${firstAct}`);

  // ── Locations and exits ──────────────────────────────────────────────────
  for (const loc of story.locations) {
    for (const p of loc.openPeriods ?? []) needPeriod(p, `locations/${loc.id}/openPeriods`);
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const [i, exit] of loc.exits.entries()) {
      const at = `locations/${loc.id}/exits[${i}]`;
      if (ids.has(exit.id)) fail(at, `duplicate exit id "${exit.id}"`);
      ids.add(exit.id);
      for (const n of exit.names) {
        const k = n.toLowerCase();
        if (names.has(k)) fail(at, `exit name "${n}" is used twice in this location`);
        names.add(k);
      }
      needLocation(exit.to, `${at}/to`);
      if (exit.to === loc.id) warn(at, 'exit leads back into the same location');
      if (exit.lock) needLock(exit.lock, at);
    }
  }

  // ── Objects ──────────────────────────────────────────────────────────────
  for (const o of story.objects) {
    const at = `objects/${o.id}`;
    needPlacement(o.placement, at);
    if (o.placement.kind === 'inventory' && !o.item) fail(at, 'placed in inventory but not an item');
    if (o.placement.kind === 'container' && o.placement.container === o.id) fail(at, 'object contains itself');
    if (o.fact) needFact(o.fact, `${at}/fact`);
    if (o.container?.lock) needLock(o.container.lock, `${at}/container`);
    if (o.container && o.container.state === 'locked' && !o.container.lock) fail(`${at}/container`, 'locked container has no lock');
    if (o.container && o.container.state !== 'locked' && o.container.lock) warn(`${at}/container`, 'container has a lock but is not locked');
  }

  // ── Persons and schedules ────────────────────────────────────────────────
  for (const p of story.persons) {
    const at = `persons/${p.id}`;
    if (p.introduction?.kind === 'document') needObject(p.introduction.object, `${at}/introduction`);
    if (p.alias && !p.introduction) warn(at, 'has an alias but no introduction, so the name can never be revealed');
    if (Object.keys(p.schedule).length === 0) warn(at, 'no schedule: the person is offstage in every act');
    for (const [actKey, entry] of Object.entries(p.schedule)) {
      const actId = Number(actKey);
      needAct(actId, `${at}/schedule/${actKey}`);
      for (const per of Object.keys(entry.byPeriod ?? {})) needPeriod(per, `${at}/schedule/${actKey}/byPeriod`);
      const places = [entry.default, ...Object.values(entry.byPeriod ?? {})];
      for (const place of places) {
        if (place.kind === 'at') needLocation(place.location, `${at}/schedule/${actKey}`);
        if (place.kind === 'follows') {
          needPerson(place.person, `${at}/schedule/${actKey}`);
          if (place.person === p.id) fail(`${at}/schedule/${actKey}`, 'follows themself');
        }
      }
    }
  }
  // Follow cycles: A follows B follows A within the same act.
  for (const p of story.persons) {
    for (const [actKey, entry] of Object.entries(p.schedule)) {
      if (entry.default.kind !== 'follows') continue;
      const seen = new Set<string>([p.id]);
      let cur: string | undefined = entry.default.person;
      while (cur) {
        if (seen.has(cur)) { fail(`persons/${p.id}/schedule/${actKey}`, `follow cycle through "${cur}"`); break; }
        seen.add(cur);
        const next = persons.get(cur)?.schedule[actKey]?.default;
        cur = next?.kind === 'follows' ? next.person : undefined;
      }
    }
  }

  // ── Facts and clues ──────────────────────────────────────────────────────
  for (const f of story.facts) {
    const at = `facts/${f.id}`;
    for (const p of f.knownBy) needPerson(p, `${at}/knownBy`);
    for (const p of Object.keys(f.voices ?? {})) needPerson(p, `${at}/voices`);
    if (f.visibleFromAct > 0 && !acts.has(f.visibleFromAct)) fail(`${at}/visibleFromAct`, `unknown act ${f.visibleFromAct}`);
  }
  // Topic phrase collisions: one phrase must resolve to one Fact.
  const phraseOwner = new Map<string, string>();
  for (const f of story.facts) for (const t of f.topics) {
    const k = t.toLowerCase();
    const prev = phraseOwner.get(k);
    if (prev && prev !== f.id) fail(`facts/${f.id}/topics`, `phrase "${t}" also belongs to fact "${prev}"`);
    phraseOwner.set(k, f.id);
  }
  for (const c of story.clues) {
    needFact(c.fact, `clues/${c.id}/fact`);
    for (const other of c.connections ?? []) {
      if (!clues.has(other)) fail(`clues/${c.id}/connections`, `unknown clue "${other}"`);
      if (other === c.id) warn(`clues/${c.id}/connections`, 'connects to itself');
    }
  }

  // ── Rules ────────────────────────────────────────────────────────────────
  const actsAdvancedTo = new Set<number>();
  const endingsReached = new Set<string>();
  const minActOfRule = (r: Rule): number => {
    const fromWhen = r.when?.act ? Math.min(...r.when.act) : undefined;
    const fromTrigger = r.trigger.kind === 'clock' && r.trigger.act ? Math.min(...r.trigger.act) : undefined;
    return Math.min(fromWhen ?? Infinity, fromTrigger ?? Infinity, fromWhen === undefined && fromTrigger === undefined ? firstAct : Infinity);
  };
  const checkConditions = (w: Conditions | undefined, at: string) => {
    if (!w) return;
    for (const a of w.act ?? []) needAct(a, `${at}/act`);
    for (const l of w.location ?? []) needLocation(l, `${at}/location`);
    for (const p of w.period ?? []) needPeriod(p, `${at}/period`);
    for (const x of w.weather ?? []) needWeather(x, `${at}/weather`);
    for (const f of w.flagsAll ?? []) flagsRead.add(f);
    for (const f of w.flagsNone ?? []) flagsRead.add(f);
    for (const o of w.hasItems ?? []) needItem(o, `${at}/hasItems`);
    for (const p of w.personsPresent ?? []) needPerson(p, `${at}/personsPresent`);
    for (const f of w.factsKnown ?? []) needFact(f, `${at}/factsKnown`);
  };
  const checkTrigger = (t: Trigger, at: string) => {
    switch (t.kind) {
      case 'action':
        for (const o of t.target ?? []) needObject(o, `${at}/target`);
        for (const o of t.secondary ?? []) needObject(o, `${at}/secondary`);
        for (const p of t.person ?? []) needPerson(p, `${at}/person`);
        break;
      case 'flag': flagsRead.add(t.flag); break;
      case 'enter': case 'leave': needLocation(t.location, `${at}/location`); break;
      case 'clock': for (const a of t.act ?? []) needAct(a, `${at}/act`); break;
      case 'tick': break;
      case 'combine': for (const o of t.items) needItem(o, `${at}/items`); break;
      case 'disclosed':
        if (t.fact) needFact(t.fact, `${at}/fact`);
        if (t.from) needPerson(t.from, `${at}/from`);
        if (t.to) needPerson(t.to, `${at}/to`);
        break;
      case 'proximity': needPerson(t.person, `${at}/person`); break;
      case 'deduction':
        for (const f of t.facts ?? []) needFact(f, `${at}/facts`);
        if (t.suspect) needPerson(t.suspect, `${at}/suspect`);
        if (!t.facts && !t.suspect) fail(at, 'deduction trigger names neither facts nor a suspect');
        break;
    }
  };
  const checkEffect = (e: Effect, at: string, ruleId: string) => {
    switch (e.kind) {
      case 'setFlag': flagsSet.set(e.flag, [...(flagsSet.get(e.flag) ?? []), ruleId]); break;
      case 'revealObject': case 'hideObject': needObject(e.object, at); break;
      case 'moveObject': needObject(e.object, at); needPlacement(e.placement, at); break;
      case 'giveItem': case 'takeItem': needItem(e.object, at); break;
      case 'lockExit': case 'unlockExit': {
        needLocation(e.location, at);
        const loc = locations.get(e.location);
        if (loc && !loc.exits.some(x => x.id === e.exit)) fail(at, `location "${e.location}" has no exit "${e.exit}"`);
        if (e.kind === 'lockExit') needLock(e.lock, at);
        break;
      }
      case 'movePerson': needPerson(e.person, at); needLocation(e.location, at); break;
      case 'summonPerson': case 'dismissPerson': needPerson(e.person, at); break;
      case 'grantFact': needPerson(e.person, at); needFact(e.fact, at); break;
      case 'setDisposition': needPerson(e.person, at); break;
      case 'playBeat': break;
      case 'cue': break;
      case 'advanceAct': needAct(e.act, at); actsAdvancedTo.add(e.act); break;
      case 'endGame':
        if (!endings.has(e.ending)) fail(at, `unknown ending "${e.ending}"`);
        endingsReached.add(e.ending);
        break;
    }
  };
  for (const r of story.rules) {
    const at = `rules/${r.id}`;
    checkTrigger(r.trigger, `${at}/trigger`);
    checkConditions(r.when, `${at}/when`);
    r.effects.forEach((e, i) => checkEffect(e, `${at}/effects[${i}]`, r.id));
    if (r.trigger.kind === 'tick' && r.weight === undefined) fail(at, 'tick rule needs a weight');
    if (r.trigger.kind !== 'tick' && r.weight !== undefined) warn(at, 'weight is only used on tick rules');
    if (r.trigger.kind === 'flag' && r.effects.some(e => e.kind === 'setFlag' && e.flag === (r.trigger as { flag: string }).flag)) {
      warn(at, 'sets the flag that triggers it');
    }
    // visibleFromAct gates who may TELL the player a Fact, not who may learn it (ADR-0005).
    // Granting it to a person early is harmless; granting it to the player early is
    // allowed but worth a look, and the prover reports the exact path as EARLY.
    for (const [i, e] of r.effects.entries()) {
      if (e.kind !== 'grantFact' || e.person !== 'player') continue;
      const f = facts.get(e.fact);
      if (f && minActOfRule(r) < f.visibleFromAct) {
        warn(`${at}/effects[${i}]`, `grants the player "${e.fact}" (visible from act ${f.visibleFromAct}) and the rule can fire in act ${minActOfRule(r)}${r.when?.act ? '' : '; add when.act if it cannot'}`);
      }
    }
    // A clock Rule at its act's start time never fires on entry (the clock starts there, it does not pass it).
    if (r.trigger.kind === 'clock') {
      const t = r.trigger;
      const can = story.acts.filter(a => (!t.act || t.act.includes(a.id)) && (!r.when?.act || r.when.act.includes(a.id)));
      for (const a of can) {
        if (t.atMinutes === a.startClockMinutes % 1440) {
          fail(`${at}/trigger`, `fires at ${t.atMinutes}, the start of act ${a.id}: the clock starts there and does not pass it, so this waits a whole day; use an enter Rule on "${a.anchorLocation}"`);
        } else {
          // Overnight Rules (midnight bells in an evening act) are normal; a wait of most of a day is not.
          const wait = (t.atMinutes - (a.startClockMinutes % 1440) + 1440) % 1440;
          if (wait > 720) warn(`${at}/trigger`, `fires at ${t.atMinutes}, ${Math.round(wait / 60)} hours after act ${a.id} starts (${a.startClockMinutes}): did you mean a time later that day?`);
        }
      }
    }
  }

  // ── Flags: every read is set somewhere; every set is read somewhere ──────
  for (const f of flagsRead) if (!flagsSet.has(f)) fail('flags', `flag "${f}" is read but nothing sets it`);
  for (const [f, where] of flagsSet) if (!flagsRead.has(f)) warn('flags', `flag "${f}" is set by ${where.join(', ')} but nothing reads it`);

  // ── Progression: every act after the first is entered; every ending ends ─
  for (const a of story.acts) if (a.id !== firstAct && !actsAdvancedTo.has(a.id)) fail(`acts/${a.id}`, 'no advanceAct effect leads here');
  for (const e of story.endings) if (!endingsReached.has(e.id)) fail(`endings/${e.id}`, 'no endGame effect reaches this ending');
  if (story.endings.length > 0 && endingsReached.size === 0) fail('rules', 'no rule ends the game');

  // ── Spoiler scan: a Fact's terms must not appear in beats seen earlier ────
  for (const f of story.facts) {
    if (!f.spoilerTerms?.length || f.visibleFromAct <= firstAct) continue;
    const terms = f.spoilerTerms.map(t => t.toLowerCase());
    const hits = (beats: string[]) => beats.filter(b => terms.some(t => b.toLowerCase().includes(t)));
    const flagBeat = (at: string, beats: string[], level: 'fail' | 'warn') => {
      for (const b of hits(beats)) issues.push({ level, at, message: `beat may leak fact "${f.id}" (visible from act ${f.visibleFromAct}): "${b.slice(0, 60)}…"` });
    };
    flagBeat('opening/beats', story.opening.beats, 'fail');
    for (const l of story.locations) flagBeat(`locations/${l.id}/beats`, l.beats, 'warn');
    for (const o of story.objects) flagBeat(`objects/${o.id}/beats`, o.beats, 'warn');
    for (const p of story.persons) flagBeat(`persons/${p.id}/beats`, p.beats, 'warn');
    for (const r of story.rules) {
      const beats = r.effects.flatMap(e => e.kind === 'playBeat' ? e.beats : []);
      flagBeat(`rules/${r.id}/effects`, beats, minActOfRule(r) < f.visibleFromAct ? 'fail' : 'warn');
    }
  }

  void rules;
  return { ok: !issues.some(i => i.level === 'fail'), story, issues };
}
