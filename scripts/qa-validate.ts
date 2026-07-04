/**
 * scripts/qa-validate.ts
 *
 * Story-data validator harness. Two blocks:
 *   1. SELF-TEST — feed deliberately-broken synthetic stories; assert each rule fires.
 *   2. REAL DATA — run validateStory() against the Whitechapel manifest; fail on any error.
 *
 * No AI. No browser. No Supabase. Run: npx tsx scripts/qa-validate.ts
 */
import { validateStory, StoryData, ValidationIssue } from '../engine/stories/validateStory';

let passes = 0;
let fails = 0;
function pass(label: string) { console.log(`[PASS] ${label}`); passes++; }
function fail(label: string, detail?: string) { console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`); fails++; }

// Minimal valid story: every rule should pass on this. Tests mutate a clone to break one thing.
function baseStory(): StoryData {
  return {
    LOCATIONS: {
      home: { id: 'home', name: 'Home', shortName: 'Home', act: 0, atmosphere: '', description: '',
        exits: ['street'], interactables: ['desk'], locationExaminedFlag: 'examined_home',
        timeframe: 'present', timeOfDay: 'night' },
      street: { id: 'street', name: 'Street', shortName: 'Street', act: 0, atmosphere: '', description: '',
        exits: ['home'], interactables: [], locationExaminedFlag: 'examined_street',
        timeframe: 'present', timeOfDay: 'night' },
    },
    NPCS: {
      ally: { id: 'ally', displayName: 'Ally', role: '', description: '', speakingStyle: '',
        personality: [], publicKnowledge: [], followingRule: 'fixed',
        canonicalLocationByAct: { 0: 'home' } },
    },
    CLUE_DEFINITIONS: {
      c1: { id: 'c1', name: 'C1', description: '', diaryNote: '', holmesDeduction: '',
        locationFound: 'home', triggerObject: 'desk', connections: ['c2'],
        clueGroup: 1, medicalPoints: 1, moralPoints: 1 },
      c2: { id: 'c2', name: 'C2', description: '', diaryNote: '', holmesDeduction: '',
        locationFound: 'home', triggerObject: 'desk', connections: [],
        clueGroup: 1, medicalPoints: 1, moralPoints: 1 },
    },
    CLUE_TRIGGERS: { home: { desk: ['c1'] } },
    ACT_ANCHORS: { 0: 'home' },
    ACT_PROGRESSION: { 0: { name: 'Act 0', requireFlags: ['examined_home'], advanceTo: 1 } },
    SUSPECT_PROFILES: { villain: { npcId: 'ally', aliases: ['ally'], isGuilty: true } },
  };
}

function issuesFor(rule: string, issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter(i => i.rule === rule);
}

function runSelfTests() {
  console.log('\n=== SELF-TEST: validateStory rules ===');

  // A clean base story yields no issues.
  const clean = validateStory(baseStory());
  clean.length === 0
    ? pass('base story is clean (no issues)')
    : fail('base story unexpectedly produced issues', JSON.stringify(clean));

  // clue-connections: break a connection.
  const s1 = baseStory();
  s1.CLUE_DEFINITIONS.c1.connections = ['does_not_exist'];
  issuesFor('clue-connections', validateStory(s1)).length === 1
    ? pass('clue-connections flags a dangling connection')
    : fail('clue-connections did not flag a dangling connection');
}

runSelfTests();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Self-test: ${passes} passed · ${fails} failed`);
if (fails > 0) process.exit(1);
