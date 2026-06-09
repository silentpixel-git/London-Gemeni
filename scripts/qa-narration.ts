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
import { aiService } from '../services/AIService';
import { NarrationContext } from '../types';
import {
  LOCATIONS,
  ACT_NAMES,
} from '../engine/gameData';

// ── Base fixture factory ──────────────────────────────────────────────────────

function makeCtx(overrides: Partial<NarrationContext>): NarrationContext {
  return {
    locationName: 'Baker Street',
    locationAtmosphere: 'Warm and intellectual — the familiar chaos of Holmes\'s working method.',
    locationDescription: 'The sitting room of 221B, lined with case notes and chemical apparatus.',
    locationTimeframe: 'present',
    act: 0,
    actName: 'The Baker Street Vigil',
    npcsPresent: [{ label: 'Sherlock Holmes', npcId: 'holmes', isIntroduced: true }],
    availableObjects: ['Case Files Wall', 'Telegrams Pile'],
    availableExits: ['Dorset Street'],
    inventory: ["Watson's Diary", 'Pocket Watch'],
    watsonStats: { medicalPoints: 0, moralPoints: 0 },
    actionType: 'move',
    actionSuccess: true,
    actionDescription: 'Watson surveys the room.',
    actionResultNote: 'Watson takes stock of the investigation.',
    narrationMode: 'full',
    newCluesDiscovered: [],
    npcRecentMemory: {},
    blockquoteHint: 'world_event',
    timeLabel: '10:45 PM — Friday, 9 November 1888',
    timePeriod: 'night',
    weather: { condition: 'foggy', label: 'Foggy' },
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

  // 2c — Writing quality
  {
    label: 'quality-opening-act0',
    rubric: '2c_writing_quality',
    ctx: makeCtx({
      narrationMode: 'opening',
      act: 0,
      actName: 'The Baker Street Vigil',
      actionDescription: "Watson arrives at Baker Street.",
      actionResultNote: "Watson enters 221B for the first time in this investigation.",
      timeLabel: '10:00 PM — Thursday, 8 November 1888',
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
];

// ── Static difficulty analysis ────────────────────────────────────────────────

function generateDifficultyAnalysis(): string {
  return `## 2d. Difficulty Assessment (Static Analysis)

### Act Gate Analysis

| Act | Gate Flags Required | Min Actions to Satisfy |
|-----|--------------------|-----------------------|
| 0   | 3 (case_files_wall, telegrams_pile, talk_holmes) | 3 examine/talk |
| 1   | 1 (examined_millers_court — any object triggers it) | 1 examine |
| 2   | 3 (mortuary + bucks_row + hanbury_street) | 3 examines across 3 locations |
| 3   | 3 (dutfields_yard + mitre_square + working_mens_club) | 3 examines across 3 locations |
| 4   | 1 (examined_lusk_office) | 1 examine |
| 5   | 1 (examined_bond_office) | 1 examine |
| 6   | 1 (visited_private_asylum) + correct deduction | 1 move + deduce |

### Clue Distribution

- Total clues in game: ~14 (clue_00 through clue_10, with variants)
- Minimum clues for deduction threshold (5): requires visiting mortuary, hanbury_street, mitre_square, lusk_office, bond_office
- Smoking gun clue (clue_06_prasarved_spelling): only discoverable at bond_office Act 5
- Red herring suspects: Dr. Bond (plausible — medical access), Inspector Abberline (authority figure)

### Questions for QA agent to assess:

1. **Is Act 1 gate too easy?** Only one examine required — player barely engages with Miller's Court before moving on.
2. **Is the deduction threshold (5 clues) appropriate?** The minimum path collects exactly 5 — no margin for missed clues.
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
