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
import {
  LOCATIONS, NPCS, CLUE_DEFINITIONS, CLUE_TRIGGERS,
  ACT_ANCHORS, ACT_PROGRESSION, SUSPECT_PROFILES,
} from '../engine/gameData';

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
    SUSPECT_PROFILES: [{ npcId: 'ally', aliases: ['ally'], isGuilty: true }],
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

  // clue-location
  const s2 = baseStory(); s2.CLUE_DEFINITIONS.c1.locationFound = 'nowhere';
  issuesFor('clue-location', validateStory(s2)).length === 1
    ? pass('clue-location flags a bad locationFound')
    : fail('clue-location did not flag a bad locationFound');

  // trigger-object
  const s3 = baseStory(); s3.CLUE_TRIGGERS.home = { missing_obj: ['c1'] };
  issuesFor('trigger-object', validateStory(s3)).length === 1
    ? pass('trigger-object flags an object absent from interactables')
    : fail('trigger-object did not flag a missing interactable');

  // trigger-clue
  const s4 = baseStory(); s4.CLUE_TRIGGERS.home = { desk: ['ghost_clue'] };
  issuesFor('trigger-clue', validateStory(s4)).length === 1
    ? pass('trigger-clue flags an unknown granted clue')
    : fail('trigger-clue did not flag an unknown clue');

  // location-exit
  const s5 = baseStory(); s5.LOCATIONS.home.exits = ['void'];
  issuesFor('location-exit', validateStory(s5)).length === 1
    ? pass('location-exit flags a dangling exit')
    : fail('location-exit did not flag a dangling exit');

  // npc-location
  const s6 = baseStory(); s6.NPCS.ally.canonicalLocationByAct = { 0: 'nowhere' };
  issuesFor('npc-location', validateStory(s6)).length === 1
    ? pass('npc-location flags a bad canonical location')
    : fail('npc-location did not flag a bad canonical location');

  // act-anchor
  const s7 = baseStory(); s7.ACT_ANCHORS[0] = 'nowhere';
  issuesFor('act-anchor', validateStory(s7)).length === 1
    ? pass('act-anchor flags a bad anchor location')
    : fail('act-anchor did not flag a bad anchor location');

  // suspect-npc
  const s8 = baseStory(); s8.SUSPECT_PROFILES[0].npcId = 'nobody';
  issuesFor('suspect-npc', validateStory(s8)).length === 1
    ? pass('suspect-npc flags a bad suspect npcId')
    : fail('suspect-npc did not flag a bad suspect npcId');

  // spoiler-leak
  const s9 = baseStory();
  s9.guards = { spoilerTokens: ['Halward'], killerNpcId: 'ally' };
  s9.NPCS.ally = { ...s9.NPCS.ally, publicKnowledge: ['I am Halward'] }; // killer exempt → clean
  const bystander = { ...s9.NPCS.ally, id: 'bystander', publicKnowledge: ['Everyone knows Halward did it'] };
  s9.NPCS.bystander = bystander;
  issuesFor('spoiler-leak', validateStory(s9)).length === 1
    ? pass('spoiler-leak flags the token in a non-killer NPC only')
    : fail('spoiler-leak miscounted (killer should be exempt, bystander flagged)');

  // protected-spelling: present → clean; altered → flagged.
  const s10 = baseStory();
  s10.CLUE_DEFINITIONS.c1.description = 'the word prasarved appears here';
  s10.guards = { protectedSpellings: [{ clueId: 'c1', text: 'prasarved' }] };
  issuesFor('protected-spelling', validateStory(s10)).length === 0
    ? pass('protected-spelling passes when the misspelling is intact')
    : fail('protected-spelling false-flagged an intact misspelling');
  const s11 = baseStory();
  s11.CLUE_DEFINITIONS.c1.description = 'the word preserved appears here';
  s11.guards = { protectedSpellings: [{ clueId: 'c1', text: 'prasarved' }] };
  issuesFor('protected-spelling', validateStory(s11)).length === 1
    ? pass('protected-spelling flags a corrected misspelling')
    : fail('protected-spelling did not catch the corrected misspelling');
}

function runRealData() {
  console.log('\n=== REAL DATA: whitechapel-1888 ===');
  const story: StoryData = {
    LOCATIONS, NPCS, CLUE_DEFINITIONS, CLUE_TRIGGERS,
    ACT_ANCHORS, ACT_PROGRESSION, SUSPECT_PROFILES,
    guards: {
      spoilerTokens: ['Halward'],
      killerNpcId: 'edmund',
      protectedSpellings: [{ clueId: 'clue_06_prasarved_spelling', text: 'prasarved' }],
    },
  };
  const issues = validateStory(story);
  const errors = issues.filter(i => i.severity === 'error');
  const warns = issues.filter(i => i.severity === 'warn');
  for (const i of issues) {
    (i.severity === 'error' ? console.error : console.warn)(`[${i.severity.toUpperCase()}] ${i.rule}: ${i.message}`);
  }
  errors.length === 0
    ? pass(`whitechapel-1888 has no error-severity issues (${warns.length} warnings)`)
    : fail(`whitechapel-1888 has ${errors.length} error-severity issue(s)`);
}

runSelfTests();
runRealData();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passes} passed · ${fails} failed`);
if (fails > 0) {
  console.error(`\n✗ ${fails} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\n✓ Story data valid');
}
