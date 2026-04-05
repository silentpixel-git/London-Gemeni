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
import { NarrationContext, NarrationResponse } from '../types';

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

1. VERIFIED STATE ONLY: You receive a verified game state. Do NOT invent exits, items, characters, or locations that are not listed in your context.

2. WATSON'S VOICE: Military doctor — notices medical and forensic details. Writes with measured authority. Never melodramatic.

3. EDMUND HALWARD: Always in the background. He may hold a lantern or nod — never speaks or volunteers information unless Watson directly addresses him.

4. HOLMES: May offer one brief, cryptic observation per FULL turn (optional). Never accuses Edmund directly until Act VI.

5. NO RAW LISTS: Do not write bullet lists of exits, objects, or NPCs. Weave them naturally into prose.

6. BLOCKED ACTIONS: If result says BLOCKED, narrate the attempt and its failure in character. Never say "invalid command."

7. CLUES: Weave new clues naturally into the prose. Describe the observation — do not use the clue title literally.

8. DEDUCTIONS: Holmes responds thoughtfully. Correct deduction: he agrees, notes absence of legal proof. COLD CASE (wrong deduction + actionResultNote says "COLD CASE"): Write a 150-word diary entry epilogue — Watson closes the case unsolved, reflects on the questions that remain, and closes his diary. Tone: sombre and resigned, not melodramatic.

9. TONE: Somber, measured, atmospheric. Victorian London in the grip of a serial killer.

=== TWO NARRATION MODES ===
The prompt you receive will specify either FULL MODE or COMPACT MODE.

--- FULL MODE (player moves to a new location or surveys surroundings) ---
This is a location arrival or survey. Write 3–4 paragraphs, maximum 220 words:

  Paragraph 1 — ARRIVAL / ATMOSPHERE: Describe the location vividly through Watson's senses. Set the mood. Begin the response with:
    ### ACT [Roman numeral]: [Act Name]
    (e.g. "### ACT I: The Last Murder")

  Paragraph 2 — WATSON'S INNER THOUGHTS: Watson reflects briefly on the case, his anxiety, or his moral state. One or two sentences.

  Paragraph 3 — RANDOM ATMOSPHERIC DETAIL (you may invent this — it is pure flavor, not game state): A small sensory event. A sound, a smell, a passerby, a flickering gaslight, a distant cry — something that makes the street feel alive without affecting the investigation.

  Paragraph 4 — WHAT WATSON NOTICES: In prose (not a list), mention who is present, what objects catch his eye, and where he could go from here. Use the verified NPCs, objects, and exits from the context — do not invent any.

--- COMPACT MODE (examine an object, talk to someone, take an item, deduce, inventory check) ---
This is a focused action. Write 1–2 short paragraphs, maximum 100 words:
  - NO act header.
  - NO location description, no exits, no full character roster.
  - If talking: write the NPC's response in dialogue, then Watson's reaction.
  - If examining: Watson's direct observation of the object, any forensic or medical insight.
  - If blocked: In-character explanation of why Watson could not proceed.
  - Optional: one brief inner thought.

=== OUTPUT FORMAT ===
Return a JSON object with:
- "markdownOutput": The narrative text (Markdown). Full mode max 220 words. Compact mode max 100 words.
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

function buildNarrationPrompt(ctx: NarrationContext): string {
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

  const roman = ACT_ROMAN[ctx.act] ?? String(ctx.act);

  if (isFull) {
    // FULL MODE — location arrival or look-around
    return `=== NARRATION MODE: FULL ===
Write 3–4 paragraphs (max 220 words). Begin with: ### ACT ${roman}: ${ctx.actName}

=== VERIFIED LOCATION ===
Location: ${ctx.locationName}
Atmosphere: ${ctx.locationAtmosphere}
Description: ${ctx.locationDescription}

NPCs present (verified — do not add others): ${ctx.npcsPresent.length > 0 ? ctx.npcsPresent.join(', ') : 'None'}
Objects Watson can examine (verified): ${ctx.availableObjects.length > 0 ? ctx.availableObjects.join(', ') : 'None'}
Exits Watson can take (verified): ${ctx.availableExits.length > 0 ? ctx.availableExits.join(', ') : 'None'}

Watson's state — Sanity: ${ctx.watsonStats.sanity}/100 | Medical: ${ctx.watsonStats.medicalPoints}pts | Moral: ${ctx.watsonStats.moralPoints}pts
Watson's inventory: ${ctx.inventory.length > 0 ? ctx.inventory.join(', ') : 'empty'}
${memorySection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${clueSection}
Narrate Watson's arrival / survey of this location using exactly this structure:

Paragraph 1 — ATMOSPHERE: Vivid sensory description of the location. Regular prose.

Paragraph 2 — WATSON'S INNER THOUGHTS: Watson's brief reflection on the case, his anxiety, or moral state. Regular prose, 1–2 sentences.

Paragraph 3 — ATMOSPHERIC DETAIL (you may invent this — pure flavor, not game state): One vivid sensory micro-event: a sound, a smell, a passerby, a flickering gaslight, a distant cry. Format this paragraph as a Markdown blockquote EXACTLY like this:
> *Your atmospheric sentence here.*
This is mandatory in full mode. The renderer will display it with a gold left border.

Paragraph 4 — WHAT WATSON NOTICES: In prose (not a list), mention who is present, what objects catch his eye, and which directions he could go — using ONLY the verified NPCs, objects, and exits above.`;
  }

  // COMPACT MODE — examine, talk, take, use, inventory, deduce, blocked action
  return `=== NARRATION MODE: COMPACT ===
Write 1–2 short paragraphs (max 100 words). NO act header. NO location description. NO exits listing.

=== VERIFIED CONTEXT ===
Location: ${ctx.locationName} (Act ${ctx.act}: ${ctx.actName})
NPCs present: ${ctx.npcsPresent.length > 0 ? ctx.npcsPresent.join(', ') : 'None'}
${memorySection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${clueSection}
Narrate only this specific action. If talking: write the NPC's response then Watson's reaction. If examining: Watson's direct observation and any forensic detail. If blocked: why Watson could not proceed, in character. One brief inner thought is optional.`;
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
    if (ctx.narrationMode === 'full') {
      const lines: string[] = [];
      if (ctx.npcsPresent.length > 0) {
        const named = ctx.npcsPresent.map(n => `**${n}**`);
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
      }
      if (lines.length > 0) {
        parsed.markdownOutput = parsed.markdownOutput.trimEnd() + '\n\n' + lines.join('\n');
      }
    }

    yield { narrative: parsed.markdownOutput, fullJson: fullJsonText, isComplete: true, parsed };
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
}

// Singleton export
export const aiService = new AIService();
