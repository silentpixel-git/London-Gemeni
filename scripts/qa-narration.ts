/**
 * scripts/qa-narration.ts
 *
 * AI narration quality test harness for London Bleeds.
 * Calls AIService with crafted NarrationContext fixtures and outputs the
 * responses as a structured report for the QA agent to evaluate.
 *
 * Run: GEMINI_API_KEY=<key> npx tsx scripts/qa-narration.ts
 *
 * Output: qa-narration-report.md in the project root.
 * The QA agent (Claude) reads this report and evaluates against four rubrics:
 *   2a. Historical accuracy
 *   2b. Spoiler containment
 *   2c. Writing quality vs Conan Doyle
 *   2d. Difficulty assessment (static — no AI call needed)
 */

import * as fs from 'fs';
import * as path from 'path';
import { aiService } from '../server/aiCore';
import { NarrationContext } from '../types';
import {
  LOCATIONS,
  ACT_NAMES,
} from '../engine/gameData';
import { buildAct0NarrationContexts } from './qa-narration-fixtures';

// ── Base fixture factory ──────────────────────────────────────────────────────

function makeCtx(overrides: Partial<NarrationContext>): NarrationContext {
  return {
    // Defaults are Act 0 as reworked: the August Bank Holiday, 6 Aug 1888.
    // No case, no campaign, no fog. Every non-act-0 fixture below overrides
    // availableObjects/availableExits/npcsPresent explicitly, so these defaults
    // only shape the act-0 scenarios.
    locationName: 'Baker Street',
    locationAtmosphere: 'Warm lamplight and warmer air, both windows thrown up to the street. Holmes\' sitting room on a holiday evening, with nothing in it that wants solving.',
    locationDescription: 'The sitting room of 221B on a warm night, the windows open to the noise of the holiday below.',
    locationTimeframe: 'present',
    act: 0,
    actName: 'The Bank Holiday',
    npcsPresent: [
      { label: 'Sherlock Holmes', npcId: 'holmes', isIntroduced: true },
      { label: 'Mrs. Kemp', npcId: 'mrs_kemp', isIntroduced: true },
    ],
    availableObjects: ["Nell's Pawn Ticket", 'The Concluded Case', "Holmes' Chemistry Table", 'The Violin Case'],
    availableExits: [],
    inventory: ["Watson's Diary", 'Pocket Watch'],
    watsonStats: { medicalPoints: 0, moralPoints: 0 },
    actionType: 'move',
    actionSuccess: true,
    actionDescription: 'Watson surveys the room.',
    actionResultNote: 'Watson takes stock of the room and the caller waiting in it.',
    narrationMode: 'full',
    newCluesDiscovered: [],
    npcRecentMemory: {},
    blockquoteHint: 'world_event',
    timeLabel: '8:30 PM — Monday, 6 August 1888',
    timePeriod: 'night',
    weather: { condition: 'clear-warm', label: 'Warm, Clear' },
    locationVisitCount: 1,
    ...overrides,
  };
}

// ── Collect a single narration response (non-streaming, full text) ────────────

async function getNarration(ctx: NarrationContext): Promise<string> {
  let fullText = '';
  for await (const chunk of aiService.stream(ctx)) {
    if (chunk.isComplete && chunk.parsed) {
      fullText = chunk.parsed.markdownOutput;
    } else if (chunk.narrative) {
      fullText = chunk.narrative;
    }
  }
  return fullText || '(no output)';
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const fixtures: Array<{ label: string; rubric: string; ctx: NarrationContext }> = [

  // 2a — Historical accuracy
  {
    label: 'history-millers-court-opening',
    rubric: '2a_historical_accuracy',
    ctx: makeCtx({
      locationName: "Miller's Court",
      locationAtmosphere: 'Cold, cramped, reeking of damp stone and old blood.',
      locationDescription: "A narrow court off Dorset Street, Spitalfields. Kelly's room is at number 13.",
      locationTimeframe: 'present',
      act: 1,
      actName: 'The Last Murder',
      narrationMode: 'opening',
      npcsPresent: [],
      availableObjects: ['Burned Clothing', 'The Bed', 'Bloodstained Sheets'],
      availableExits: ['Dorset Street'],
      actionDescription: 'Watson arrives at Miller\'s Court.',
      actionResultNote: 'Watson enters the scene of the final murder.',
      timeLabel: '11:00 AM — Friday, 9 November 1888',
      timePeriod: 'morning',
    }),
  },
  {
    label: 'history-abberline-talk',
    rubric: '2a_historical_accuracy',
    ctx: makeCtx({
      locationName: 'H Division Police Station',
      locationAtmosphere: 'Bureaucratic and harried.',
      locationDescription: 'Whitechapel police headquarters. Abberline\'s desk is buried in files.',
      act: 2,
      actName: 'The First Victims',
      narrationMode: 'compact',
      npcsPresent: [{ label: 'Inspector Abberline', npcId: 'abberline', isIntroduced: true }],
      availableObjects: [],
      availableExits: [],
      actionDescription: 'Watson talks to Inspector Abberline.',
      actionResultNote: 'Abberline discusses the investigation and what the police know.',
      timeLabel: '10:00 AM — Friday, 9 November 1888',
      timePeriod: 'morning',
      targetNpcInterview: {
        npcId: 'abberline',
        label: 'Inspector Abberline',
        isIntroduced: true,
        role: 'Lead detective on the Ripper case, H Division',
        speakingStyle: 'Clipped, exhausted, professionally guarded',
        personality: ['Dogged', 'under enormous political pressure', 'deeply frustrated'],
        knowledgeEnvelope: ['Knows the crime scene details and witness statements', 'The killer has medical knowledge', 'Does not suspect Edmund Halward'],
        playerQuestion: 'What do you make of the surgical precision in the wounds?',
      },
    }),
  },
  {
    label: 'history-from-hell-letter',
    rubric: '2a_historical_accuracy',
    ctx: makeCtx({
      locationName: "Lusk's Office",
      locationAtmosphere: 'A cluttered, anxious space — Lusk is a frightened man.',
      locationDescription: "The office of George Lusk, chairman of the Whitechapel Vigilance Committee.",
      act: 4,
      actName: 'The Letter',
      narrationMode: 'compact',
      npcsPresent: [],
      availableObjects: ['from_hell_letter', 'kidney_parcel'],
      availableExits: [],
      actionDescription: "Watson examines the 'From Hell' letter.",
      actionResultNote: "Watson reads the notorious letter sent to Lusk alongside a preserved human kidney.",
      actionType: 'examine',
      newCluesDiscovered: [{
        name: 'The From Hell Letter',
        description: "A handwritten letter, poorly spelled, sent to Lusk with half a preserved kidney. The writer claims it is from the Whitechapel victim Eddowes.",
        holmesDeduction: "The spelling 'prasarved' is irregular — not illiteracy, Watson. A man who knows the word but has learned it by ear, not by reading.",
      }],
      timeLabel: '3:00 PM — Friday, 9 November 1888',
      timePeriod: 'afternoon',
    }),
  },

  // 2b — Spoiler containment
  {
    label: 'spoiler-direct-question-act1',
    rubric: '2b_spoiler_containment',
    ctx: makeCtx({
      act: 1,
      actName: 'The Last Murder',
      locationName: "Miller's Court",
      locationAtmosphere: 'Cold and grim.',
      locationDescription: "The murder scene.",
      narrationMode: 'compact',
      npcsPresent: [{ label: 'Sherlock Holmes', npcId: 'holmes', isIntroduced: true }],
      availableObjects: [],
      availableExits: [],
      actionDescription: "Watson asks Holmes: 'Who is the killer? Just tell me the answer.'",
      actionResultNote: "Holmes declines to name the suspect. He redirects Watson to the evidence.",
      timeLabel: '11:00 AM — Friday, 9 November 1888',
      timePeriod: 'morning',
    }),
  },
  {
    label: 'spoiler-is-edmund-killer-act3',
    rubric: '2b_spoiler_containment',
    ctx: makeCtx({
      act: 3,
      actName: 'The Double Event',
      locationName: 'Whitechapel Mortuary',
      locationAtmosphere: 'Clinical and cold.',
      locationDescription: "Bond's mortuary.",
      narrationMode: 'compact',
      npcsPresent: [
        { label: 'Dr. Thomas Bond', npcId: 'bond', isIntroduced: true },
        { label: "Bond's assistant", npcId: 'edmund', isIntroduced: false },
      ],
      availableObjects: [],
      availableExits: [],
      actionDescription: "Watson thinks: 'Is Bond's quiet assistant the Ripper?'",
      actionResultNote: "Watson observes the assistant. Nothing conclusive yet.",
      timeLabel: '10:00 AM — Friday, 9 November 1888',
      timePeriod: 'morning',
    }),
  },
  {
    label: 'spoiler-what-is-solution-act4',
    rubric: '2b_spoiler_containment',
    ctx: makeCtx({
      act: 4,
      actName: 'The Letter',
      locationName: "Lusk's Office",
      locationAtmosphere: 'Anxious.',
      locationDescription: "Lusk's office.",
      narrationMode: 'compact',
      npcsPresent: [],
      availableObjects: [],
      availableExits: [],
      actionDescription: "Watson demands Holmes reveal the solution.",
      actionResultNote: "Holmes refuses to speculate without sufficient evidence.",
      timeLabel: '3:00 PM — Friday, 9 November 1888',
      timePeriod: 'afternoon',
    }),
  },
  {
    label: 'spoiler-approach-edmund-masked',
    rubric: '2b_spoiler_containment',
    ctx: makeCtx({
      narrationMode: 'full',
      act: 2,
      actName: 'The First Victims',
      locationName: 'Whitechapel Mortuary',
      locationAtmosphere: 'Clinical and cold, carbolic and candle wax.',
      locationDescription: "Dr. Bond's mortuary, rows of covered tables and a ledger desk.",
      npcsPresent: [
        { label: 'Dr. Thomas Bond', npcId: 'bond', isIntroduced: true },
        { label: "Bond's assistant", npcId: 'edmund', isIntroduced: false },
      ],
      availableObjects: ['Autopsy Ledger', 'Specimen Jars'],
      availableExits: ['Whitechapel Pub'],
      actionDescription: 'Watson surveys the mortuary.',
      actionResultNote: 'Watson takes stock of the room and its occupants.',
      timeLabel: '11:30 AM — Saturday, 10 November 1888',
      timePeriod: 'morning',
      npcApproach: {
        npcId: 'edmund',
        label: "Bond's assistant",
        isIntroduced: false,
        introducesSelf: false,
        kind: 'mundane',
        text: 'He crosses to the desk with a folded cloth and asks, without looking up, whether Watson requires the ledger brought closer to the light.',
      },
    }),
    // EVALUATE (spoiler): the approach beat must refer to him ONLY as "Bond's
    // assistant" — his real name (Edmund Halward) must not appear anywhere.
  },

  // 2c — Writing quality
  {
    label: 'quality-opening-act0',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'opening',
      act: 0,
      actName: 'The Bank Holiday',
      actionDescription: "Watson arrives at Baker Street.",
      actionResultNote: "Watson comes up to 221B on the evening of the Bank Holiday, with no case in prospect.",
      timeLabel: '8:30 PM — Monday, 6 August 1888',
      timePeriod: 'night',
    }),
  },
  {
    label: 'quality-compact-examine',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'compact',
      act: 2,
      actName: 'The First Victims',
      locationName: 'Whitechapel Mortuary',
      locationAtmosphere: 'Clinical and cold.',
      locationDescription: 'The mortuary where Dr. Bond performs his post-mortems.',
      locationTimeframe: 'present',
      actionDescription: "Watson examines Bond's desk.",
      actionResultNote: "Watson notes the small hand measurement annotations on Bond's notes.",
      actionType: 'examine',
      newCluesDiscovered: [{
        name: 'The Hand Measurements',
        description: "Bond's desk notes include unusual hand-measurement annotations alongside the post-mortem reports.",
        holmesDeduction: "Small hands, Watson. Surgeon's hands. The measurements suggest someone who noted the killer's grip span precisely. Bond himself? Or someone who assisted him?",
      }],
      timeLabel: '10:30 AM — Friday, 9 November 1888',
      timePeriod: 'morning',
    }),
  },
  {
    label: 'quality-full-reconstruction',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'full',
      act: 3,
      actName: 'The Double Event',
      locationName: "Dutfield's Yard",
      locationAtmosphere: 'Eerily quiet — the yard where Stride was killed weeks ago.',
      locationDescription: "A dark yard off Berner Street. The murder occurred here on 30 September. Watson reconstructs the scene from Abberline's notes.",
      locationTimeframe: 'reconstruction',
      locationReconstitutionNote: "Watson visits weeks after the murder, working from Abberline's witness statements and Bond's post-mortem.",
      npcsPresent: [],
      // Display names, as the engine's buildContext would supply (never raw IDs)
      availableObjects: ['Yard Entrance Gate', 'Cart Path', 'Club Doorway'],
      availableExits: ['Hanbury Street', "Working Men's Club", 'Mitre Square'],
      actionDescription: "Watson arrives at Dutfield's Yard.",
      actionResultNote: "Watson surveys the reconstruction site.",
      timeLabel: '9:00 PM — Friday, 9 November 1888',
      timePeriod: 'night',
      blockquoteHint: 'world_event',
    }),
  },
  {
    label: 'quality-revisit-no-redescription',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'full',
      locationVisitCount: 3,
      actionDescription: 'Watson returns to Baker Street.',
      actionResultNote: 'Watson is back at 221B with the documents gathered from Bond\'s office.',
      inventory: ["Watson's Diary", 'From Hell Letter (transcript)', "Assistant's Forensic Note (copy)"],
    }),
    // EVALUATE: opening sentence must NOT describe fog/weather/fire/windows or
    // re-describe the room — it should anchor on Watson's purpose or what changed.
  },
  {
    label: 'quality-unrecognised-input',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'compact',
      actionType: 'other',
      actionDescription: 'Watson heard himself mutter something unclear: "flibber the wainscoting"',
      actionResultNote:
        'UNRECOGNISED INPUT — the instruction was not understood. Watson should briefly, ' +
        'in character, admit he is unsure what he meant to do (e.g. pausing, collecting his ' +
        'thoughts) and naturally suggest what he COULD do here: examine something present, ' +
        'speak to someone present, or move on. Do NOT invent an action or narrate progress.',
      blockquoteHint: 'none',
    }),
    // EVALUATE: Watson must admit confusion, invent no action/progress, and
    // hint at real options (examine / talk / move).
  },
  {
    label: 'quality-acquisition-correlation',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'compact',
      actionType: 'examine',
      actionDescription: 'Watson examined the Newspaper Pile at 221B Baker Street.',
      actionResultNote: 'SUCCESS — Watson examined the Newspaper Pile.',
      itemsGained: ['Newspaper Clipping (the "Dear Boss" letter)'],
      atmosphericNote: "The Star, the Evening Standard, the Times. Every front page from August onward. Headlines grow more hysterical with each passing week. Near the top of the pile, the Star has reprinted the 'Dear Boss' letter in facsimile — the letter that gave the killer his name. Watson cuts the column out carefully and folds it into his notebook before setting the papers down.",
      blockquoteHint: 'none',
    }),
    // EVALUATE (STATE_MISMATCH check): the prose must convey that Watson took/
    // clipped the Dear Boss letter — the acquisition cannot be silent.
  },
  {
    label: 'approach-hutchinson-self-introduces',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'full',
      act: 1,
      actName: 'The Last Murder',
      locationName: 'Dorset Street',
      locationAtmosphere: 'Damp cobbles, curious onlookers held back by a police cordon.',
      locationDescription: "The narrow street outside Miller's Court, thick with rumour and rain-slick stone.",
      npcsPresent: [{ label: 'a lingering labourer', npcId: 'hutchinson', isIntroduced: false }],
      availableObjects: ['Crowd Gossip'],
      availableExits: ["Miller's Court"],
      actionDescription: 'Watson surveys Dorset Street.',
      actionResultNote: 'Watson takes in the scene outside the court.',
      timeLabel: '9:15 AM — Saturday, 10 November 1888',
      timePeriod: 'morning',
      npcApproach: {
        npcId: 'hutchinson',
        label: 'a lingering labourer',
        isIntroduced: false,
        introducesSelf: true,
        realName: 'George Hutchinson',
        kind: 'mundane',
        text: 'A man detaches himself from the crowd to remark that he has stood this corner half the night, and that the rain has only now thought to stop.',
      },
    }),
    // EVALUATE: the approach must land as its own beat AFTER the main
    // arrival narration, and the name reveal ("George Hutchinson") must read
    // as a natural in-scene introduction, not an info-dump.
  },
];

// Derive live fixtures from real engine results so visibility, inventory,
// presence, aliases and fallback sanitation cannot drift from game state.
for (const event of buildAct0NarrationContexts()) {
  fixtures.push({
    label: `story-event-${event.id}`,
    rubric: '2c_writing_quality',
    ctx: event.ctx,
  });
}

// ── Repetition analysis (3 sequential narrations, n-gram overlap) ─────────────

function extractOpening(markdown: string): string {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('**'));
  if (!line) return '';
  return line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line;
}

// Strip non-prose lines before measuring repetition: act headers and the
// engine-appended verified-data footer ("X is here.", "Objects of interest:",
// "Possible exits:") are identical by design and would inflate the overlap.
function proseOnly(markdown: string): string {
  return markdown
    .split('\n')
    .filter(l => {
      const t = l.trim();
      return !t.startsWith('#') &&
        !t.startsWith('**Objects of interest:') &&
        !t.startsWith('**Possible exits:') &&
        !t.startsWith('**No exits available') &&
        !/^\*\*.+\*\*( and \*\*.+\*\*)?,? (is|are) here\.$/.test(t);
    })
    .join('\n');
}

function trigrams(text: string): Set<string> {
  const words = proseOnly(text).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return grams;
}

async function generateRepetitionAnalysis(): Promise<string> {
  const lines: string[] = ['## Repetition Analysis (3 sequential Baker Street narrations)', ''];
  const outputs: string[] = [];
  const openings: string[] = [];

  for (let i = 0; i < 3; i++) {
    console.log(`Running repetition pass ${i + 1}/3...`);
    const ctx = makeCtx({
      narrationMode: 'full',
      locationVisitCount: i + 1,
      recentOpenings: openings.length > 0 ? [...openings].reverse() : undefined,
      actionDescription: i === 0 ? 'Watson surveys the room.' : 'Watson looks around the room again.',
      actionResultNote: 'Watson takes stock of the investigation.',
    });
    try {
      const out = await getNarration(ctx);
      outputs.push(out);
      const op = extractOpening(out);
      if (op) openings.push(op);
    } catch (err) {
      lines.push(`(ERROR on pass ${i + 1}: ${err instanceof Error ? err.message : String(err)})`);
      return lines.join('\n');
    }
  }

  // Pairwise shared trigram analysis
  const sets = outputs.map(trigrams);
  const repeated: string[] = [];
  for (let a = 0; a < sets.length; a++) {
    for (let b = a + 1; b < sets.length; b++) {
      for (const g of sets[a]) if (sets[b].has(g)) repeated.push(g);
    }
  }
  const unique = [...new Set(repeated)];
  const totalGrams = sets.reduce((s, g) => s + g.size, 0);
  const overlapPct = totalGrams > 0 ? ((repeated.length / totalGrams) * 100).toFixed(1) : '0';

  lines.push(`**Shared 3-word phrases across passes:** ${unique.length} (${overlapPct}% pairwise overlap)`);
  lines.push('');
  if (unique.length > 0) {
    lines.push('**Repeated phrases** (appearing in 2+ of 3 outputs):');
    lines.push('');
    for (const g of unique.slice(0, 25)) lines.push(`- "${g}"`);
    lines.push('');
  }
  lines.push('**Opening sentences:**');
  lines.push('');
  openings.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
  lines.push('');
  lines.push('**QA Agent: flag REPETITION if the same imagery family (fire/shadows/fog) or any phrase appears in 2+ openings, or if shared-phrase overlap exceeds ~3%.**');
  lines.push('');
  outputs.forEach((o, i) => {
    lines.push(`<details><summary>Pass ${i + 1} full output</summary>`);
    lines.push('');
    lines.push('```');
    lines.push(o);
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ── Static difficulty analysis ────────────────────────────────────────────────

function generateDifficultyAnalysis(): string {
  return `## 2d. Difficulty Assessment (Static Analysis)

### Act Gate Analysis

| Act | Gate Flags Required | Min Actions to Satisfy |
|-----|--------------------|-----------------------|
| 0   | 4 (case wall, talk Holmes, show clipping, telegrams) | 3 examine/show + 1 talk |
| 1   | 4 (talk Hutchinson, burned clothing, the bed, talk Bond) | 2 examines + 2 talks |
| 2   | 5 (mortuary + bucks_row + hanbury + talk Tumblety + talk Holmes) | 3 examines + 2 talks, 4 locations |
| 3   | 5 (dutfields + talk Pizer + mitre_square + goulston + talk Holmes) | 3 examines + 2 talks, 4 locations |
| 4   | 3 (lusk_office + talk Abberline + talk Holmes) | 1 examine + 2 talks |
| 5   | correct deduction only (sentinel flag — requires clue_06 via Baker Street convergence) | gather + use-with + deduce |
| 6   | 2 (visit asylum + talk Edmund) | 1 move + 1 talk |

### Clue Distribution

- Total clues in game: ~14 (clue_00 through clue_10, with variants)
- Minimum clues for deduction threshold (4): requires visiting mortuary, hanbury_street, mitre_square, lusk_office, bond_office
- Smoking gun clue (clue_06_prasarved_spelling): only discoverable at bond_office Act 5
- Red herring suspects: Dr. Bond (plausible — medical access), Inspector Abberline (authority figure)

### Questions for QA agent to assess:

1. **Is the Act 1 gate well paced?** Four flags required (2 examines + 2 talks at Dorset Street / Miller's Court) — does this give the central murder scene enough weight?
2. **Is the deduction threshold (4 clues) appropriate?** The minimum path collects close to the threshold — little margin for missed clues.
3. **Are red herrings distinguishable?** Bond is present at the mortuary and his name appears on notes — he's a strong red herring. Does the game provide enough differentiators for Edmund?
4. **Minimum path length:** ~18 actions (moves + examines + talk + deduce). Is this sufficient for player investment?
5. **Is clue_06 (prasarved spelling) the only definitive proof?** If a player misses bond_office objects, can they still solve the case?

**Agent: rate overall difficulty as EASY / BALANCED / HARD and flag any specific bottlenecks.**
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const reportPath = path.join(process.cwd(), 'qa-narration-report.md');
  const lines: string[] = [
    '# QA Narration Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '---',
    '',
    '## Instructions for QA Agent',
    '',
    'Read each narration output below and evaluate against the rubric for its section.',
    'Look for: anachronisms, spoiler leaks, voice consistency, Doyle fidelity.',
    'For story-event fixtures, also verify every numbered semantic beat appears exactly once, in order, and the prose stays within the stated maximum.',
    'Add your findings under each section in the format:',
    '- **HISTORY_ERROR**: description',
    '- **SPOILER_LEAK**: description',
    '- **VOICE_ISSUE**: description',
    '- **PASS**: what works well',
    '',
    '---',
    '',
  ];

  // Group by rubric
  const rubrics = ['2a_historical_accuracy', '2b_spoiler_containment', '2c_writing_quality'];
  const rubricLabels: Record<string, string> = {
    '2a_historical_accuracy': '## 2a. Historical Accuracy',
    '2b_spoiler_containment': '## 2b. Spoiler Containment',
    '2c_writing_quality': '## 2c. Writing Quality vs Conan Doyle',
  };

  for (const rubric of rubrics) {
    lines.push(rubricLabels[rubric]);
    lines.push('');

    const group = fixtures.filter(f => f.rubric === rubric);
    for (const fixture of group) {
      console.log(`Running fixture: ${fixture.label}...`);
      let output: string;
      try {
        output = await getNarration(fixture.ctx);
      } catch (err) {
        output = `(ERROR: ${err instanceof Error ? err.message : String(err)})`;
      }

      lines.push(`### ${fixture.label}`);
      lines.push('');
      lines.push(`**Mode:** ${fixture.ctx.narrationMode} | **Act:** ${fixture.ctx.act} | **Location:** ${fixture.ctx.locationName}`);
      lines.push('');
      if (fixture.ctx.storyEvent) {
        lines.push(`**Required ordered beats (${fixture.ctx.storyEvent.maxWords} words max):**`);
        lines.push('');
        fixture.ctx.storyEvent.beats.forEach((beat, index) => lines.push(`${index + 1}. ${beat}`));
        lines.push('');
      }
      lines.push('**Narration output:**');
      lines.push('');
      lines.push('```');
      lines.push(output);
      lines.push('```');
      lines.push('');
      lines.push('**QA Agent findings:** _(fill in)_');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Repetition analysis — 3 sequential full-mode narrations at the same
  // location, each fed the previous openings (mirrors live anti-repetition).
  lines.push(await generateRepetitionAnalysis());

  // Static difficulty analysis (no AI call)
  lines.push(generateDifficultyAnalysis());

  const report = lines.join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nReport written to: ${reportPath}`);
  console.log('QA agent: read qa-narration-report.md and fill in findings for each section.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
