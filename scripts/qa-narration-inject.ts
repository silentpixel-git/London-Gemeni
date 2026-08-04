/**
 * scripts/qa-narration-inject.ts
 *
 * Deterministic regression guard for the authored-line injection that splices
 * the opening's fixed line and each act's arrival "bridge" into AI-streamed
 * narration (services/narrationFormat.ts → injectAfterHeading, consumed by
 * hooks/useGameState.ts generateOpeningScene / streamArrivalScene).
 *
 * This covers the MECHANICAL seam only — that the authored line lands as its own
 * paragraph after the `### ACT …` heading, survives the mid-stream partial
 * heading, and is a no-op when absent. The AI *content* seam (does the model
 * duplicate or contradict the bridge?) is non-deterministic and is assessed by
 * the qa-narration rubric / qa-playthrough agent, not here.
 *
 *   Deterministic pass — offline, no API key.
 *
 * Run: npx tsx scripts/qa-narration-inject.ts
 * Exit code 1 if any assertion fails.
 */

import { injectAfterHeading, stripLeadingActHeading, formatActHeading } from '../services/narrationFormat';
import { ACT_BRIDGES, ACT_NAMES } from '../engine/gameData';
import { ACT_ROMAN } from '../constants';
import { buildNarrationPrompt, finalizeNarrationResponse } from '../server/aiCore';
import {
  cloudPersistOutcome,
  mergeNarrationContinuity,
  narrationCloudPersisted,
  streamFollowUpNarration,
} from '../hooks/gameState/narration';
import { buildAct0NarrationContexts } from './qa-narration-fixtures';
import type { EngineResult, GameHistoryItem, NarrationContext } from '../types';

let passed = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { passed++; } else { failures.push(label); }
}

// ── Helper-level cases ────────────────────────────────────────────────────────

const HEADING = '### ACT I: The Last Murder\n\n';
const SCENE = 'The drizzle coated the cobbles of Dorset Street.';
const LINE = 'A bridge sentence.';

// 1. Complete heading: line becomes its own paragraph between heading and scene.
{
  const out = injectAfterHeading(HEADING + SCENE, LINE);
  check('complete heading: heading stays first', out.startsWith(HEADING));
  check('complete heading: line sits after heading, before scene',
    out === HEADING + LINE + SCENE);
  check('complete heading: line appears exactly once', out.split(LINE).length === 2);
}

// 2. Mid-stream: heading not yet terminated by a newline → line prepends, and
//    the prepend must not survive once the newline arrives (case 1 proves the
//    snap-back). Here we only assert the transient prepend is well-formed.
{
  const partial = '### ACT I: The Last';
  const out = injectAfterHeading(partial, LINE);
  check('mid-stream: line prepends ahead of the partial heading', out === LINE + partial);
}

// 3. Empty line is a strict no-op (acts without a bridge pass '').
{
  const full = HEADING + SCENE;
  check('empty line: returns input unchanged', injectAfterHeading(full, '') === full);
}

// 4. No heading at all: degrade to a plain prepend (never drop the line).
{
  const out = injectAfterHeading(SCENE, LINE);
  check('no heading: line prepends to plain text', out === LINE + SCENE);
}

// 5. Only the FIRST heading is targeted (a later `###` in the scene is untouched).
{
  const body = HEADING + 'Intro.\n\n### A later subhead\n\nMore.';
  const out = injectAfterHeading(body, LINE);
  check('multiple headings: line lands after the first only',
    out === HEADING + LINE + 'Intro.\n\n### A later subhead\n\nMore.');
}

// ── stripLeadingActHeading (defensive net — prompts no longer ask for a heading) ──

// A. Complete heading line is removed along with its trailing blank line(s).
{
  const out = stripLeadingActHeading(HEADING + SCENE);
  check('strip: heading line removed, scene preserved', out === SCENE);
}

// B. Partial mid-stream heading (no newline yet) strips to nothing until the
//    line completes — never show a half-typed heading.
{
  check('strip: partial heading strips to empty',
    stripLeadingActHeading('### ACT I: The La') === '');
}

// C. Text without a heading is untouched.
{
  check('strip: no heading is a no-op', stripLeadingActHeading(SCENE) === SCENE);
}

// D. Strip-then-inject composition — the exact consumer order in useSceneStreams.
{
  const out = injectAfterHeading(stripLeadingActHeading(HEADING + SCENE), LINE);
  check('strip+inject: authored line leads, heading gone', out === LINE + SCENE);
}

// E. Only the leading line goes — a later ### subhead in the body survives.
{
  const body = HEADING + 'Intro.\n\n### A later subhead\n\nMore.';
  check('strip: later subhead untouched',
    stripLeadingActHeading(body) === 'Intro.\n\n### A later subhead\n\nMore.');
}

// ── formatActHeading (feed chrome string — CSS uppercases it) ─────────────────
{
  check('formatActHeading: prologue',
    formatActHeading(0) === 'Prologue: The Bank Holiday');
  check('formatActHeading: act 3 roman numeral',
    formatActHeading(3) === 'Act III: The Double Event');
  check('formatActHeading: unknown act degrades gracefully',
    formatActHeading(9) === 'Act 9');
}

// ── ACT_BRIDGES integration ───────────────────────────────────────────────────

// Act 0 is the opening proper (its own fixed line) — it must NOT carry a bridge.
check('ACT_BRIDGES: no entry for act 0 (the opening)', ACT_BRIDGES[0] === undefined);

// Acts 1–6 each have a non-empty bridge that composes correctly with a real
// `### ACT <roman>: <name>` heading (the format generateOpeningScene/
// streamArrivalScene rely on).
for (let act = 1; act <= 6; act++) {
  const bridge = ACT_BRIDGES[act];
  check(`act ${act}: bridge is a non-empty string`, typeof bridge === 'string' && bridge.length > 0);
  if (typeof bridge !== 'string' || bridge.length === 0) continue;

  const heading = `### ACT ${ACT_ROMAN[act] ?? act}: ${ACT_NAMES[act]}\n\n`;
  const scene = 'Watson surveys the scene.';
  const out = injectAfterHeading(heading + scene, bridge + '\n\n');

  check(`act ${act}: heading remains first`, out.startsWith(heading));
  check(`act ${act}: bridge follows the heading immediately`,
    out === heading + bridge + '\n\n' + scene);
  check(`act ${act}: bridge text appears exactly once`, out.split(bridge).length === 2);
}

// ── Phase 4b: recentlyHeard prompt section ───────────────────────────────

const baseInterviewCtx: NarrationContext = {
  locationName: 'Test Room', locationAtmosphere: 'quiet', locationDescription: 'a room',
  locationVisitCount: 2, locationTimeframe: 'present',
  act: 5, actName: 'The Convergence', timeLabel: '10:00 AM — Tuesday, 20 November 1888',
  timePeriod: 'morning', weather: { condition: 'foggy', label: 'Foggy' },
  npcsPresent: [{ label: 'Dr. Phillips', npcId: 'phillips', isIntroduced: true }],
  availableObjects: [], availableExits: [], inventory: [],
  watsonStats: { medicalPoints: 0, moralPoints: 0 },
  actionType: 'talk', actionSuccess: true,
  actionDescription: 'Watson addressed Dr. Phillips.', actionResultNote: 'SUCCESS',
  newCluesDiscovered: [], narrationMode: 'compact', blockquoteHint: 'none',
  targetNpcInterview: {
    npcId: 'phillips', label: 'Dr. Phillips', isIntroduced: true,
    role: 'Divisional Surgeon', speakingStyle: 'measured', personality: ['precise'],
    knowledgeEnvelope: ['HEARSAY-LINE-XYZ', 'background fact'],
    playerQuestion: 'ask phillips about the letter',
    recentlyHeard: ['HEARSAY-LINE-XYZ'],
  },
} as NarrationContext;

{
  const prompt = buildNarrationPrompt(baseInterviewCtx);
  check('recentlyHeard: section renders when present',
    prompt.includes('RECENTLY HEARD') && prompt.includes('HEARSAY-LINE-XYZ'));
  check('recentlyHeard: instructs unprompted raising',
    /UNPROMPTED/i.test(prompt));

  const without = buildNarrationPrompt({
    ...baseInterviewCtx,
    targetNpcInterview: { ...baseInterviewCtx.targetNpcInterview!, recentlyHeard: undefined },
  } as NarrationContext);
  check('recentlyHeard: section absent when not set', !without.includes('RECENTLY HEARD'));
}

// ── Action-triggered story-event prompt contract ────────────────────────────

{
  const prompt = buildNarrationPrompt({
    ...baseInterviewCtx,
    targetNpcInterview: undefined,
    storyEvent: {
      id: 'act0_bell_rang',
      maxWords: 70,
      beats: [
        'The bell goes at last.',
        'Watson recognises the caller has committed herself to entering.',
      ],
      notice: '**Door bell** is ringing.',
    },
  });

  check('story event: prompt has a required numbered section',
    prompt.includes('=== REQUIRED STORY EVENT ===') &&
    prompt.includes('1. The bell goes at last.') &&
    prompt.includes('2. Watson recognises the caller has committed herself to entering.'));
  check('story event: prompt requires exact once-only authored order in one response',
    /every semantic beat exactly once and in the numbered order/i.test(prompt) &&
    /one Watson response/i.test(prompt));
  check('story event: prompt preserves relationships and forbids connective invention',
    /complete each numbered beat before beginning the next/i.test(prompt) &&
    /preserve who did what/i.test(prompt) &&
    /not present in the verified Result or numbered beats/i.test(prompt));
  check('story event: negative beats forbid partial answers or speculative dialogue',
    /hard constraints/i.test(prompt) &&
    /no partial answer, explanation, speculation, motive, hint, promise, or plan/i.test(prompt));
  check('story event: concealed contents cannot leak through connective prose',
    /never name or describe a container's contents/i.test(prompt) &&
    /verified scenery, inventory, Result, or numbered beats/i.test(prompt));
  check('story event: unsupplied NPC roles cannot be inferred',
    /do not assign a role, title, occupation, or relationship/i.test(prompt) &&
    /use only their verified label/i.test(prompt));
  check('story event: event word ceiling governs the turn',
    /max 70 words total/i.test(prompt));

  const eventInterviewPrompt = buildNarrationPrompt({
    ...baseInterviewCtx,
    targetNpcInterview: {
      ...baseInterviewCtx.targetNpcInterview!,
      topic: { label: 'an unrelated topic', statement: 'EXTRA TOPIC FACT MUST NOT COMPETE' },
    },
    storyEvent: {
      id: 'act0_kemp_business',
      maxWords: 130,
      beats: ['Mrs Kemp explains the purpose of her visit.'],
    },
  });
  check('story event: ordinary interview directives cannot compete with ordered beats',
    !eventInterviewPrompt.includes('=== NPC INTERVIEW ===') &&
    !eventInterviewPrompt.includes('EXTRA TOPIC FACT MUST NOT COMPETE'));
  check('story event: speaker identity and manner survive interview suppression',
    eventInterviewPrompt.includes('=== STORY EVENT CHARACTER ===') &&
    eventInterviewPrompt.includes('Divisional Surgeon') &&
    eventInterviewPrompt.includes('Speaking style: measured') &&
    eventInterviewPrompt.includes('Personality: precise'));

  const fallbackCharacterPrompt = buildNarrationPrompt({
    ...baseInterviewCtx,
    targetNpcInterview: undefined,
    storyEventCharacter: {
      label: 'Mrs. Kemp',
      isIntroduced: true,
      role: 'A caller and guest, never a servant',
      speakingStyle: 'Plain and unhurried; she does not plead.',
      personality: ['Plain-spoken', 'Tired', 'Not pitiable'],
    },
    storyEvent: {
      id: 'act0_kemp_business_fallback',
      maxWords: 130,
      beats: ['Mrs Kemp states why she has come.'],
    },
  } as NarrationContext);
  check('story event fallback: sanitized speaker profile preserves character voice',
    fallbackCharacterPrompt.includes('=== STORY EVENT CHARACTER ===') &&
    fallbackCharacterPrompt.includes('A caller and guest, never a servant') &&
    fallbackCharacterPrompt.includes('Plain and unhurried; she does not plead.'));
}

{
  const legacyAuthoredPassage = 'AUTHORED PASSAGE MUST NOT BE APPENDED';
  const ctx = {
    ...baseInterviewCtx,
    targetNpcInterview: undefined,
    scriptedBeat: { text: legacyAuthoredPassage, style: 'prose' as const },
    storyEvent: {
      id: 'act0_bell_rang',
      maxWords: 70,
      beats: ['The bell goes at last.'],
      notice: '**Door bell** is ringing.',
    },
  } as NarrationContext & { scriptedBeat: { text: string; style: 'prose' } };
  const final = finalizeNarrationResponse(ctx, { markdownOutput: 'Gemini integrated prose.' });

  check('story event: generated prose receives no mechanically appended authored passage',
    !final.markdownOutput.includes(legacyAuthoredPassage));
  check('story event: deterministic notice may follow generated prose',
    final.markdownOutput === 'Gemini integrated prose.\n\n**Door bell** is ringing.');
}

{
  let history: GameHistoryItem[] = [
    { role: 'user', text: 'examine the workbox' },
    { role: 'assistant', text: 'Main action narration.' },
  ];
  const streamedContexts: NarrationContext[] = [];
  const followUp: NonNullable<EngineResult['followUpEvent']> = {
    storyEvent: {
      id: 'act0_kemp_business_fallback',
      maxWords: 130,
      beats: ['Mrs Kemp can bear the delay no longer and explains her business.'],
    },
    effects: { act0_kemp_business_heard: true },
    aiContext: {
      ...baseInterviewCtx,
      targetNpcInterview: undefined,
      storyEvent: {
        id: 'act0_kemp_business_fallback',
        maxWords: 130,
        beats: ['Mrs Kemp can bear the delay no longer and explains her business.'],
      },
    },
  };
  const stream = (ctx: NarrationContext) => {
    streamedContexts.push(ctx);
    return (async function* () {
      yield { narrative: 'Fallback partial', fullJson: '', isComplete: false };
      yield {
        narrative: 'Fallback complete.',
        fullJson: '',
        isComplete: true,
        parsed: { markdownOutput: 'Fallback complete.' },
      };
    })();
  };

  await streamFollowUpNarration(followUp, stream, update => { history = update(history); });

  check('story event fallback: streams its own narration context',
    streamedContexts.length === 1 &&
    streamedContexts[0] === followUp.aiContext &&
    streamedContexts[0].storyEvent?.id === 'act0_kemp_business_fallback');
  check('story event fallback: appends a distinct feed item after the main action',
    history.length === 3 &&
    history[1].text === 'Main action narration.' &&
    history[2].role === 'assistant' &&
    history[2].text === 'Fallback complete.');

  let incompleteError = '';
  try {
    await streamFollowUpNarration(
      followUp,
      () => (async function* () {
        yield { narrative: 'Only a partial response', fullJson: '', isComplete: false };
      })(),
      update => { history = update(history); },
    );
  } catch (error) {
    incompleteError = error instanceof Error ? error.message : String(error);
  }
  check('story event fallback: an incomplete stream reaches the generic-error path',
    /ended before a complete response/i.test(incompleteError));
}

{
  const initial = {
    npcStates: {
      mrs_kemp: {
        npcId: 'mrs_kemp', disposition: 50, status: 'alive', memory: ['Earlier memory'],
      },
    },
    stim: {},
  };
  const afterMain = mergeNarrationContinuity(initial, {
    markdownOutput: 'Main action.',
    npcMemoryUpdate: { mrs_kemp: 'Main action summary' },
    stimUpdate: {
      kemp_gloves: { summary: 'Her gloves stayed tightly clasped in her lap.', scope: 'npc', turnCreated: 0 },
    },
  }, 12);
  const afterFollowUp = mergeNarrationContinuity(afterMain, {
    markdownOutput: 'Fallback response.',
    npcMemoryUpdate: { mrs_kemp: 'Fallback business summary' },
    stimUpdate: {
      kemp_gloves: { summary: 'A conflicting later observation.', scope: 'npc', turnCreated: 0 },
      kemp_voice: { summary: 'Her voice remained plain, low, and perfectly controlled.', scope: 'npc', turnCreated: 0 },
    },
  }, 12);

  check('narration continuity: main and follow-up NPC memories merge in stream order',
    JSON.stringify(afterFollowUp.npcStates.mrs_kemp.memory) ===
      JSON.stringify(['Fallback business summary', 'Main action summary', 'Earlier memory']));
  check('narration continuity: first STIM observation wins across both responses',
    afterFollowUp.stim.kemp_gloves.summary === 'Her gloves stayed tightly clasped in her lap.' &&
    afterFollowUp.stim.kemp_voice.turnCreated === 12);
}

{
  const fixtures = new Map(buildAct0NarrationContexts().map(fixture => [fixture.id, fixture.ctx]));
  const arrival = fixtures.get('act0_kemp_arrives')!;
  const reconstruction = fixtures.get('act0_reconstruction')!;
  const give = fixtures.get('act0_give_card')!;
  const withhold = fixtures.get('act0_withhold_card')!;
  const fallback = fixtures.get('act0_kemp_business_fallback')!;

  check('story event fixtures: arrival cannot see evidence that is still concealed',
    !arrival.availableObjects.some(label => /letter|correspondence|subscriber|charity card/i.test(label)) &&
    !arrival.inventory.some(label => /letter|correspondence|subscriber|charity card/i.test(label)));
  check('story event fixtures: reconstruction exposes the discovered subscriber card',
    [...reconstruction.availableObjects, ...reconstruction.inventory]
      .some(label => /subscriber|charity card/i.test(label)));
  check('story event fixtures: post-choice context carries the card in inventory',
    withhold.inventory.some(label => /subscriber|charity card/i.test(label)));
  check('story event fixtures: giving the card removes it from Watson inventory',
    !give.inventory.some(label => /subscriber|charity card/i.test(label)));
  check('story event fixtures: a departing character does not create an alone-cast contradiction',
    !buildNarrationPrompt(give).includes('The cast of this scene is exactly two'));
  check('story event fixtures: pivotal turns suppress competing atmospheric notes',
    reconstruction.atmosphericNote === undefined &&
    give.atmosphericNote === undefined);
  check('story event fixtures: fallback is a distinct sanitized speaker context',
    fallback.storyEvent?.id === 'act0_kemp_business_fallback' &&
    fallback.targetNpcInterview === undefined &&
    fallback.storyEventCharacter?.label === 'Mrs. Kemp');
  check('story event fixtures: post-open fallback keeps engine-derived contents truthful',
    fallback.availableObjects.some(label => /correspondence/i.test(label)) &&
    fallback.availableObjects.some(label => /subscriber.*card/i.test(label)));
  check('story event fixtures: fallback adds no closed or concealed contradiction',
    !/closed tin|conceal|must not be named/i.test(buildNarrationPrompt(fallback)) &&
    /Holmes.*(?:asks|invites).*Mrs Kemp/i.test(fallback.storyEvent?.beats[0] ?? ''));
}

{
  check('narration cloud persistence: both writes must succeed',
    narrationCloudPersisted(true, true));
  check('narration cloud persistence: failed NPC continuity write fails the turn sync',
    !narrationCloudPersisted(false, true));
  check('narration cloud persistence: failed full-state save fails the turn sync',
    !narrationCloudPersisted(true, false));
  check('cloud failure streak: later success cannot clear an earlier same-turn failure',
    JSON.stringify(cloudPersistOutcome(false, [false, true, true])) ===
      JSON.stringify({ failed: true, shouldNotify: true }));
  check('cloud failure streak: a continuing later-phase failure does not notify again',
    JSON.stringify(cloudPersistOutcome(true, [true, true, false])) ===
      JSON.stringify({ failed: true, shouldNotify: false }));
  check('cloud failure streak: only an entirely successful turn clears the streak',
    JSON.stringify(cloudPersistOutcome(true, [true, true, true])) ===
      JSON.stringify({ failed: false, shouldNotify: false }));
  check('cloud failure streak: main-stream throw finalizes earlier false persistence',
    JSON.stringify(cloudPersistOutcome(false, [false, true], false)) ===
      JSON.stringify({ failed: true, shouldNotify: true }));
  check('cloud failure streak: follow-up throw marks an otherwise successful write sequence incomplete',
    JSON.stringify(cloudPersistOutcome(false, [true, true], false)) ===
      JSON.stringify({ failed: true, shouldNotify: true }));
  check('cloud failure streak: narration throw cannot clear an existing streak',
    JSON.stringify(cloudPersistOutcome(true, [true, true], false)) ===
      JSON.stringify({ failed: true, shouldNotify: false }));
}

// ── Report ────────────────────────────────────────────────────────────────────

const total = passed + failures.length;
console.log(`\nNarration injection — ${passed}/${total} assertions passed.`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  [FAIL] ${f}`);
  process.exit(1);
}
console.log('[PASS] Authored-line injection is intact.');
