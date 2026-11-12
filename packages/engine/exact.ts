// The exact-command fast path (ADR-0003): the few inputs that need no
// selection model. Pure. Anything it does not recognise returns null and the
// model decides. Exits match only by the names the Story authored for them,
// so the engine still knows no direction a Story did not declare.
import type { CandidateSet, Selection } from '../schema/index.js';

const VERBS: Record<string, 'look' | 'inventory' | 'wait'> = {
  look: 'look', l: 'look', 'look around': 'look',
  inventory: 'inventory', inv: 'inventory', i: 'inventory',
  wait: 'wait', z: 'wait',
};

/** Text-adventure abbreviations; they resolve only if an exit here carries the full name. */
const ABBREVIATIONS: Record<string, string> = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest', u: 'up', d: 'down',
};

export function exactSelection(text: string, set: CandidateSet): Selection | null {
  const t = text.toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim();
  const verb = VERBS[t];
  if (verb) return set.verbs.includes(verb) ? { kind: 'intent', verb } : null;

  const bare = t.replace(/^go (to )?/, '');
  const word = ABBREVIATIONS[bare] ?? bare;
  const same = (name: string) => name.toLowerCase() === word;
  // A bare word that also names something here is ambiguous: the model decides.
  if (set.objects.some(o => same(o.name) || (o.aliases ?? []).some(same)) || set.persons.some(p => same(p.name))) return null;
  const exits = set.exits.filter(x => x.names.some(same));
  return exits.length === 1 && set.verbs.includes('move') ? { kind: 'intent', verb: 'move', exit: exits[0].id } : null;
}
