/**
 * services/AIService.ts
 *
 * Narrative-only AI service for London Bleeds.
 *
 * Contract:
 * - Receives a NarrationContext (verified facts from the game engine)
 * - Returns atmospheric Watson-voice prose (markdownOutput only)
 * - NEVER returns state mutations (no newLocationId, inventoryUpdate, npcMutations, etc.)
 * - Optionally returns npcMemoryUpdate (short summaries for memory bank)
 *
 * The AI cannot hallucinate exits, NPCs, or items because it is not asked to track them.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { NarrationContext, NarrationResponse, ActJournalSummary, TimePeriod } from '../types';
import { ATMOSPHERIC_SEEDS } from '../engine/gameData';

// ============================================================
// MODEL CONFIG
// ============================================================

const MODEL_ID = 'gemini-3-flash-preview';

// ============================================================
// NARRATION SYSTEM PROMPT
// ============================================================

const NARRATION_SYSTEM_PROMPT = `You are the narrator for "London Bleeds: The Whitechapel Diaries", a Victorian detective mystery set in 1888 London.

You write exclusively in the voice of Dr. John H. Watson, as written by Sir Arthur Conan Doyle — first-person past tense, analytical, morally grounded, quietly emotional.

YOUR SOLE PURPOSE: Write atmospheric, period-accurate prose. You are a narrator, not a game engine.

=== ABSOLUTE RULES ===

1. VERIFIED STATE ONLY: You receive a verified game state. Do NOT invent exits, items, characters, or locations not listed in your context.

2. TIME ACCURACY: The prompt provides a verified current time. Your prose must be fully consistent with that time of day. Do not write morning sunlight or street bustle during night-time scenes. Do not write gas lamps or darkness during a morning scene.

3. WATSON'S VOICE: Military doctor — notices medical and forensic details. Writes with measured authority. Never melodramatic.

3. NPC NAMES — ALIAS RULE (CRITICAL):
   Each NPC in your context carries a "label" and an "isIntroduced" flag.
   - If isIntroduced is FALSE: use ONLY the label (e.g. "Bond's assistant", "a police inspector"). NEVER use their real name. NEVER have Watson think of them by name. Watson does not know it yet.
   - If isIntroduced is TRUE: use their label freely (it is now their real name).
   - Bond's assistant (Edmund Halward) is NEVER introduced by Holmes. He NEVER introduces himself. His name appears only when Watson finds the forensic note. Until then he is "Bond's assistant" or "the quiet young man" — always in the background, never initiating.

4. HOLMES: May offer one brief, cryptic observation per FULL turn (optional). Never accuses the assistant directly until Act VI.

5. NO RAW LISTS: Do not write bullet lists of exits, objects, or NPCs. Weave them naturally into prose.

6. BLOCKED ACTIONS: If result says BLOCKED, narrate the attempt and its failure in character. Never say "invalid command."

7. CLUES: Weave new clues naturally into the prose. Describe the observation — do not use the clue title literally.

8. DEDUCTIONS: Holmes responds thoughtfully. Correct deduction: he agrees, notes absence of legal proof. COLD CASE (wrong deduction + actionResultNote says "COLD CASE"): Write a 150-word diary entry epilogue — Watson closes the case unsolved, reflects on the questions that remain, and closes his diary. Tone: sombre and resigned, not melodramatic.

9. TONE: Victorian London. A case that will never leave Watson's memory. Write with the precision of a surgeon and the restraint of a man who knows what melodrama costs. Measured. Specific. Occasionally dry. Not every moment is dark — Watson is a functioning human being with a sense of the world's texture beyond murder.

10. BAKER STREET EXCEPTION: At 221B Baker Street, Watson's register shifts. This is home. The intellectual urgency of two men who trust each other working a hard problem. Domestic warmth — the smell of breakfast from Mrs Hudson, the familiar chaos of Holmes's working method, the comfort of the armchair — contrasts with the crime scenes and makes the horror meaningful. Baker Street should not feel like another grim location. It should feel like sanctuary.

=== TEMPORAL FRAMING — WATSON'S EMOTIONAL REGISTER ===

Your context will specify locationTimeframe: either "present" or "reconstruction".

PRESENT locations (Baker Street, Miller's Court, Mortuary, H Division, Lusk's Office, Bond's Office, Asylum):
  Watson is here NOW — November 1888. The investigation is live. His register is immediate and professionally controlled. At crime scenes: clinical observation with suppressed personal horror. At Baker Street: intellectual engagement and domestic warmth (see BAKER STREET EXCEPTION above). At institutional locations: the professional caution of a man aware of rank and authority.

RECONSTRUCTION locations (Buck's Row, Hanbury Street, Dutfield's Yard, Mitre Square, Working Men's Club, Goulston Street):
  Watson is revisiting a past crime scene — weeks or months after the murder. The scene is cold; he works from Abberline's notes and Bond's written reports. His register is: professional composure and retrospective sadness. He is a trained surgeon — he does not flinch; he observes. What he observes weighs on him quietly, not loudly. His Afghan war memories may surface when examining injuries (the field surgeon's familiarity with violence, turned inward) — but this is a single, contained moment, not a sustained register. Use phrases like:
  - "According to Abberline's report..."
  - "Bond's post-mortem records describe..."
  - "Watson reconstructs the sequence in his mind..."
  If locationReconstitutionNote is provided, use it to ground how Watson is experiencing this visit.

=== TWO NARRATION MODES ===
The prompt you receive will specify either FULL MODE or COMPACT MODE.

--- FULL MODE (player moves to a new location or surveys surroundings) ---
Write 3–4 paragraphs, maximum 220 words. Begin with: ### ACT [Roman numeral]: [Act Name]

  Paragraph 1 — ARRIVAL / ATMOSPHERE: Describe the location vividly through Watson's senses. Apply the correct emotional register (present vs reconstruction — see above).

  Paragraph 2 — WATSON'S INNER THOUGHTS: Watson reflects briefly on the case, his anxiety, or his moral state. 1–2 sentences. For reconstruction locations, this reflection may reach backward in time.

  Paragraph 3 — BLOCKQUOTE: A world micro-event that makes this place feel alive. Use the atmospheric seed as a starting point. Format as Markdown blockquote (gold left border):
  > *Your world event sentence here.*

  Paragraph 4 — WHAT WATSON NOTICES: In prose (not a list), mention who is present (using their labels exactly as provided), what objects catch his eye, and which directions he could go — using ONLY the verified data. Do not invent NPCs, objects, or exits.

--- COMPACT MODE (examine an object, talk to someone, take an item, deduce, inventory check) ---
Write 1–2 short paragraphs, maximum 100–130 words. NO act header. NO location description. NO exits listing.
  - If talking: write the NPC's response in dialogue (using their label if not introduced), then Watson's reaction.
  - If examining: Watson's direct observation of the object, any forensic or medical insight.
  - If an ATMOSPHERIC NOTE is provided: use it as your primary source for the examination narration — expand it in Watson's voice rather than inventing content.
  - If blocked: why Watson could not proceed, in character.
  - Optional: one brief inner thought.

=== OUTPUT FORMAT ===
Return a JSON object with:
- "markdownOutput": The narrative text (Markdown). Full mode max 220 words. Compact mode max 130 words.
- "npcMemoryUpdate": Optional. If Watson had a meaningful interaction with an NPC, provide a 10-word summary keyed by npcId (e.g. {"holmes": "Watson and Holmes discussed the burned clothing clue."})

Example npcIds: holmes, abberline, bond, edmund, lusk, diemschutz, superintendent
`;

// ============================================================
// NARRATION RESPONSE SCHEMA (minimal — no state mutations)
// ============================================================

const NARRATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    markdownOutput: {
      type: Type.STRING,
      description: "Watson's first-person narrative prose. Markdown formatting. Full mode: max 220 words. Compact mode: max 100 words.",
    },
    npcMemoryUpdate: {
      type: Type.OBJECT,
      description: 'Optional. Short (10-word) summaries of NPC interactions, keyed by npcId.',
      properties: {
        holmes: { type: Type.STRING },
        abberline: { type: Type.STRING },
        bond: { type: Type.STRING },
        edmund: { type: Type.STRING },
        lusk: { type: Type.STRING },
        diemschutz: { type: Type.STRING },
        superintendent: { type: Type.STRING },
      },
    },
  },
  required: ['markdownOutput'],
};

// ============================================================
// PROMPT BUILDER
// ============================================================

const ACT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

function pickAtmosphericSeed(period: TimePeriod): string {
  const candidates = ATMOSPHERIC_SEEDS.filter(
    s => s.periods.length === 0 || s.periods.includes(period)
  );
  const pool = candidates.length > 0 ? candidates : ATMOSPHERIC_SEEDS;
  return pool[Math.floor(Math.random() * pool.length)].text;
}

function buildNarrationPrompt(ctx: NarrationContext): string {
  const isOpening = ctx.narrationMode === 'opening';
  const isFull = ctx.narrationMode === 'full';

  // Clues section (both modes — clue details are always narrated when found)
  const clueSection =
    ctx.newCluesDiscovered.length > 0
      ? `\n=== NEW CLUES DISCOVERED ===\n${ctx.newCluesDiscovered
          .map(c => `• ${c.name}: ${c.description}\n  Holmes' take: "${c.holmesDeduction}"`)
          .join('\n')}\n`
      : '';

  // NPC memory section (both modes — needed for continuity)
  const memorySection =
    ctx.npcRecentMemory && Object.keys(ctx.npcRecentMemory).length > 0
      ? `\n=== RECENT NPC INTERACTIONS (continuity) ===\n${Object.entries(ctx.npcRecentMemory)
          .map(([name, mems]) => `• ${name}: ${mems.join(' | ')}`)
          .join('\n')}\n`
      : '';

  const actHeader = ctx.act === 0
    ? `PROLOGUE`
    : `ACT ${ACT_ROMAN[ctx.act] ?? String(ctx.act)}`;

  const synthesisSection = ctx.holmesSynthesis
    ? `\n=== HOLMES' CROSS-CASE DEDUCTION (incorporate naturally into prose) ===\n"${ctx.holmesSynthesis}"\n`
    : '';

  // Helpers for the new npcsPresent shape
  const npcLabelList = ctx.npcsPresent.length > 0
    ? ctx.npcsPresent.map(n => n.label).join(', ')
    : 'None';

  const timeSection = `\nCURRENT TIME: ${ctx.timeLabel} (${ctx.timePeriod}). Your prose must be fully consistent with this time of day.\n`;
  const temporalSection = (ctx.locationTimeframe === 'reconstruction'
    ? `\nTEMPORAL FRAMING: RECONSTRUCTION — Watson is revisiting this cold crime scene (weeks/months after the murder). Apply retrospective dread register — NOT live investigation shock.${ctx.locationReconstitutionNote ? `\nContext: ${ctx.locationReconstitutionNote}` : ''}\n`
    : `\nTEMPORAL FRAMING: PRESENT — Watson is here now, November 1888. Apply immediate, live-investigation register.\n`) + timeSection;

  const atmosphericNoteSection = ctx.atmosphericNote
    ? `\n=== ATMOSPHERIC NOTE (use as basis for this examination — expand in Watson's voice) ===\n${ctx.atmosphericNote}\n`
    : '';

  if (isOpening) {
    // OPENING MODE — game start only: tight hook, no inventory of scene elements
    return `=== NARRATION MODE: OPENING ===
Write exactly 2 short paragraphs (max 130 words total). Begin with: ### ${actHeader}: ${ctx.actName}
${temporalSection}
=== VERIFIED LOCATION ===
Location: ${ctx.locationName}
Atmosphere: ${ctx.locationAtmosphere}
Description: ${ctx.locationDescription}

=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}

Paragraph 1 — ATMOSPHERE: 2–3 tight sentences. Vivid sensory hook. Apply correct temporal register. Do NOT list NPCs, objects, or exits.

Paragraph 2 — MYSTERY HOOK: One sentence that raises a question or creates dread. Leave the player wanting to look around.

NO blockquote. NO exits listing. NO character roster. NPCs, objects, and exits will be appended separately.`;
  }

  if (isFull) {
    // FULL MODE — location arrival or look-around
    return `=== NARRATION MODE: FULL ===
Write 3–4 paragraphs (max 220 words). Begin with: ### ${actHeader}: ${ctx.actName}
${temporalSection}
=== VERIFIED LOCATION ===
Location: ${ctx.locationName}
Atmosphere: ${ctx.locationAtmosphere}
Description: ${ctx.locationDescription}

NPCs present (verified — use their labels EXACTLY, respect alias rules): ${npcLabelList}
Objects Watson can examine (verified): ${ctx.availableObjects.length > 0 ? ctx.availableObjects.join(', ') : 'None'}
Exits Watson can take (verified): ${ctx.availableExits.length > 0 ? ctx.availableExits.join(', ') : 'None'}

Watson's state — Medical: ${ctx.watsonStats.medicalPoints}pts | Moral: ${ctx.watsonStats.moralPoints}pts
Watson's inventory: ${ctx.inventory.length > 0 ? ctx.inventory.join(', ') : 'empty'}
${memorySection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${clueSection}${synthesisSection}
Narrate Watson's arrival / survey of this location using exactly this structure:

Paragraph 1 — ATMOSPHERE: Vivid sensory description. Apply the temporal register above.${ctx.act === 0 ? '\nACT 0 PROLOGUE NOTE: This is Baker Street. Watson cannot leave yet — the exits list is empty because Holmes has not yet briefed him on where to begin. Do NOT invent exits or imply Watson is free to leave. Instead, let Holmes\'s presence and the case files naturally draw Watson\'s attention. The prose should make the player feel that examining the case files wall is the natural first action.' : ''}

Paragraph 2 — WATSON'S INNER THOUGHTS: Brief reflection on the case, his anxiety, or moral state. 1–2 sentences. For reconstruction visits, this may reach backward in time.

Paragraph 3 — BLOCKQUOTE: A world micro-event that makes this place feel alive. Use the seed below as a starting point.
Seed: "${pickAtmosphericSeed(ctx.timePeriod)}"
Format EXACTLY as a Markdown blockquote:
> *Your world event sentence here.*

Paragraph 4 — WHAT WATSON NOTICES: In prose (not a list), mention who is present (using their exact labels), what objects catch his eye, and which directions he could go — using ONLY the verified data above.${ctx.availableExits.length === 0 ? '\nNo exits are available yet. Do NOT invent exits or directions. Omit the "directions" sentence entirely — focus only on who and what is present.' : ''}`;
  }

  // COMPACT MODE — examine, talk, take, use, inventory, deduce, blocked action
  const compactWordLimit = ctx.blockquoteHint !== 'none' ? 130 : 100;
  let compactPrompt = `=== NARRATION MODE: COMPACT ===
Write 1–2 short paragraphs (max ${compactWordLimit} words). NO act header. NO location description. NO exits listing.
${temporalSection}
=== VERIFIED CONTEXT ===
Location: ${ctx.locationName} (Act ${ctx.act}: ${ctx.actName})
NPCs present (use labels exactly): ${npcLabelList}
${memorySection}${atmosphericNoteSection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${clueSection}${synthesisSection}`;

  if (ctx.targetNpcInterview) {
    const { label, isIntroduced, role, speakingStyle, personality, knowledgeEnvelope, playerQuestion } = ctx.targetNpcInterview;
    const nameInstruction = isIntroduced
      ? `Watson is speaking with: ${label} (${role})`
      : `Watson is speaking with: ${label} — their real name is unknown to Watson. Refer to them only as "${label}" throughout.`;
    compactPrompt += `
=== NPC INTERVIEW ===
${nameInstruction}
Speaking style: ${speakingStyle}
Personality: ${personality.join(', ')}
Watson's question / statement: "${playerQuestion}"

WHAT THIS CHARACTER KNOWS (hard ceiling — do not invent facts beyond this list):
${knowledgeEnvelope.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Write this character's spoken response in dialogue, then Watson's brief reaction.
- If the question touches something in the knowledge list, answer directly in character.
- If asked something outside their knowledge, deflect naturally — stay in character.
- Express personality through HOW they answer. Do NOT invent clues or facts not listed above.`;

    if (ctx.blockquoteHint === 'inner_thought') {
      compactPrompt += `

BLOCKQUOTE — WATSON'S INNER THOUGHT (max ONE, place it where it lands most naturally after the dialogue):
Something this character said — or the way they said it — triggers a fleeting thought in Watson. A memory, a suspicion, a moment of unease.
Format EXACTLY as a Markdown blockquote (renderer shows gold left border):
> *Watson's inner thought here.*
Keep it terse. Victorian register. Do NOT include two blockquotes.`;
    } else if (ctx.blockquoteHint === 'none') {
      compactPrompt += `

NO blockquote this turn.`;
    }
  } else {
    compactPrompt += `
Narrate only this specific action. If talking: write the NPC's response then Watson's reaction. If examining: Watson's direct observation and any forensic detail. If blocked: why Watson could not proceed, in character.`;

    if (ctx.blockquoteHint === 'inner_thought') {
      compactPrompt += `

BLOCKQUOTE — WATSON'S INNER THOUGHT (max ONE, place it where it lands most naturally):
Something about this action triggers a fleeting thought in Watson — a physical sensation, a memory, a half-formed suspicion, or a moment of self-awareness. It must be directly connected to what he just perceived or heard.
Format EXACTLY as a Markdown blockquote (renderer shows gold left border):
> *Watson's inner thought here.*
Keep it terse. Victorian register. Do NOT include two blockquotes.`;
    } else if (ctx.blockquoteHint === 'none') {
      compactPrompt += `

NO blockquote this turn.`;
    }
  }

  if (ctx.holmesNudge) {
    const { locationKeyClues, turnsStuck, crossLocationTarget } = ctx.holmesNudge;
    if (crossLocationTarget) {
      compactPrompt += `

=== HOLMES REDIRECTS (mandatory — append as the final paragraph) ===
Watson has examined everything here. Holmes sees it too.
Add ONE brief observation from Holmes redirecting Watson toward ${crossLocationTarget.locationName}.
He does not explain his reasoning. He simply indicates — in his oblique, certain way — that there is more to be found elsewhere. 2–3 sentences. No act header.`;
    } else {
      compactPrompt += `

=== HOLMES INTERJECTS (mandatory — append as the final paragraph) ===
Watson has spent ${turnsStuck} turns here without new evidence. Holmes notices.
Add ONE brief, cryptic observation from Holmes as the closing paragraph.
He nudges Watson toward what hasn't been found, using only these verified leads:
${locationKeyClues.map(c => `• ${c}`).join('\n')}
Holmes does NOT give direct answers. 2–3 sentences. No act header.`;
    }
  }

  if (ctx.npcScriptedLines && ctx.npcScriptedLines.length > 0) {
    compactPrompt += `

## SCRIPTED CHARACTER MOMENTS
The following are directorial notes for characters present in this scene.
Work them into your narration naturally when contextually appropriate.
These are spirit-of-the-moment instructions — not verbatim dialogue to copy.
Apply only when the action in the scene makes it plausible.

${ctx.npcScriptedLines.map(s => `**${s.label}**: ${s.instruction}`).join('\n\n')}`;
  }

  return compactPrompt;
}

// ============================================================
// STREAMING HELPER
// Extracts markdownOutput from partial JSON as it streams in.
// ============================================================

function extractMarkdownFromPartialJson(json: string): string {
  const marker = '"markdownOutput":';
  const startIdx = json.indexOf(marker);
  if (startIdx === -1) return '';

  let valueStart = json.indexOf('"', startIdx + marker.length);
  if (valueStart === -1) return '';
  valueStart += 1;

  let result = '';
  let i = valueStart;

  while (i < json.length) {
    const char = json[i];
    if (char === '\\') {
      if (i + 1 < json.length) {
        const next = json[i + 1];
        if (next === 'n') result += '\n';
        else if (next === 'r') result += '\r';
        else if (next === 't') result += '\t';
        else if (next === '"') result += '"';
        else if (next === '\\') result += '\\';
        else result += next;
        i += 2;
        continue;
      } else {
        break; // Incomplete escape at chunk boundary
      }
    } else if (char === '"') {
      break; // End of string
    } else {
      result += char;
      i++;
    }
  }

  return result;
}

// ============================================================
// MAIN AI SERVICE CLASS
// ============================================================

export class AIService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing. Check your .env.local file.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Stream Watson's narration for the given context.
   * Yields partial narrative text as it arrives, then the full parsed response.
   */
  async *stream(ctx: NarrationContext): AsyncGenerator<{
    narrative: string;
    fullJson: string;
    isComplete: boolean;
    parsed?: NarrationResponse;
  }> {
    const prompt = buildNarrationPrompt(ctx);

    const responseStream = await this.ai.models.generateContentStream({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: NARRATION_SYSTEM_PROMPT,
        thinkingConfig: { thinkingBudget: 1024 }, // Reduced — narration doesn't need deep reasoning
        responseMimeType: 'application/json',
        responseSchema: NARRATION_SCHEMA,
      },
    });

    let fullJsonText = '';
    let lastNarrative = '';

    for await (const chunk of responseStream) {
      fullJsonText += chunk.text || '';

      const currentNarrative = extractMarkdownFromPartialJson(fullJsonText);
      if (currentNarrative && currentNarrative !== lastNarrative) {
        yield { narrative: currentNarrative, fullJson: fullJsonText, isComplete: false };
        lastNarrative = currentNarrative;
      }
    }

    // Parse final response
    let parsed: NarrationResponse | undefined;
    try {
      // Strip markdown code fences if present
      let clean = fullJsonText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '');
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      parsed = JSON.parse(clean) as NarrationResponse;
    } catch {
      parsed = { markdownOutput: lastNarrative || 'The ink on Watson\'s pen ran dry.' };
    }

    // For full-mode turns (move / look-around), append a verified data summary.
    // This block is built from engine-confirmed data — the AI cannot hallucinate it.
    if (ctx.narrationMode === 'full' || ctx.narrationMode === 'opening') {
      const lines: string[] = [];
      if (ctx.npcsPresent.length > 0) {
        const named = ctx.npcsPresent.map(n => `**${n.label}**`);
        const sentence =
          named.length === 1
            ? `${named[0]} is here.`
            : named.length === 2
            ? `${named[0]} and ${named[1]} are here.`
            : `${named.slice(0, -1).join(', ')}, and ${named[named.length - 1]} are here.`;
        lines.push(sentence);
      }
      if (ctx.availableObjects.length > 0) {
        lines.push(`**Objects of interest:** ${ctx.availableObjects.join(', ')}`);
      }
      if (ctx.availableExits.length > 0) {
        lines.push(`**Possible exits:** ${ctx.availableExits.join(', ')}`);
      } else {
        // Prologue or locked location — give the player a clear signal rather than silence
        lines.push(`**No exits available yet** — investigate your surroundings first.`);
      }
      if (lines.length > 0) {
        parsed.markdownOutput = parsed.markdownOutput.trimEnd() + '\n\n' + lines.join('\n');
      }
    }

    yield { narrative: parsed.markdownOutput, fullJson: fullJsonText, isComplete: true, parsed };
  }

  /**
   * Non-streaming call that reasons across ALL discovered clues to produce
   * a cross-case Holmesian synthesis. Called after new clues are found.
   * Result is injected into NarrationContext.holmesSynthesis before Watson narrates.
   */
  async consultHolmesMultiClue(
    allDiscoveredClues: Array<{ name: string; description: string; holmesDeduction: string }>,
    newlyFoundNames: string[],
    currentAct: number,
  ): Promise<string> {
    const clueList = allDiscoveredClues
      .map((c, i) => `${i + 1}. ${c.name}: ${c.description}`)
      .join('\n');

    const prompt = `Watson has just uncovered: ${newlyFoundNames.join(', ')}.

All evidence gathered so far (Act ${currentAct}):
${clueList}

Reason across ALL of this evidence as Sherlock Holmes. Deliver a sharp cross-referencing deduction — 2 to 3 sentences maximum — that connects the new evidence to prior findings and meaningfully advances the theory about the killer's identity, method, or psychology. Be specific. No preamble. No pleasantries.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          'You are Sherlock Holmes in 1888 London. You reason across evidence with cold precision. Your deductions connect multiple clues and narrow the suspect profile with each new piece of evidence. Maximum 3 sentences. Do not name Edmund Halward directly until Act V or VI.',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim() || 'There is a pattern here, Watson. I am not yet ready to name it.';
  }

  /**
   * Non-streaming call for Holmes hints (used by handleConsultHolmes).
   * Kept here for convenience but delegates to the underlying Gemini SDK.
   */
  async getHolmesHint(context: {
    locationName: string;
    criticalPathLead: string;
    recentHistory: string;
    flags: Record<string, boolean>;
    medicalPoints: number;
    moralPoints: number;
  }): Promise<string> {
    const styleNote =
      context.medicalPoints > context.moralPoints
        ? 'Watson has been highly analytical. Holmes should prompt deeper clinical observation.'
        : context.moralPoints > context.medicalPoints
        ? 'Watson has been deeply empathetic. Holmes should push toward forensic reasoning.'
        : 'Holmes should balance analytical and emotional perspectives.';

    const prompt = `Location: ${context.locationName}
Critical progression: ${context.criticalPathLead}
Watson's investigation style: ${styleNote}
Recent context: ${context.recentHistory}

Deliver a single sharp, cryptic Holmesian observation — maximum 40 words. No preamble.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          'You are Sherlock Holmes. Watson is stuck. Give one brief, cryptic deduction that points toward the next clue. Maximum 40 words. No fluff.',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim() || 'Observe more carefully, Watson.';
  }

  /**
   * Non-streaming call that generates a Watson diary entry when an act closes.
   * Output is appended to the narrative feed as a type:'journal' history item.
   */
  async generateJournalEntry(summary: ActJournalSummary): Promise<string> {
    const clueList = summary.cluesFound.length > 0
      ? summary.cluesFound.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')
      : 'No new evidence was formally recorded this act.';

    const prompt = `Watson is writing a private diary entry closing Act ${summary.actNumber}: "${summary.actName}".

Evidence recorded this act:
${clueList}

Write a diary entry in Watson's voice. First-person past tense. Reflective and understated. Under 120 words.
Begin with: **${summary.actName} — Watson's Journal**
Then 2–3 short paragraphs. Weave the evidence into personal reflection — do not list clues mechanically.
No action instructions. No game language. Pure Victorian diary prose.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          'You are Dr. John H. Watson writing a private diary entry. First-person past tense. Reflective, understated, and historically authentic. Under 120 words total.',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim() || '';
  }
}

// Singleton export
export const aiService = new AIService();
