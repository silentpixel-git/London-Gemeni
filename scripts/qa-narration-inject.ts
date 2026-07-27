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
import { buildNarrationPrompt } from '../server/aiCore';
import type { NarrationContext } from '../types';

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

// ── Report ────────────────────────────────────────────────────────────────────

const total = passed + failures.length;
console.log(`\nNarration injection — ${passed}/${total} assertions passed.`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  [FAIL] ${f}`);
  process.exit(1);
}
console.log('[PASS] Authored-line injection is intact.');
