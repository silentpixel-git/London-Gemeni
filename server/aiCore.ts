/**
 * server/aiCore.ts
 *
 * Narrative-only AI service for London Bleeds — SERVER-SIDE implementation.
 *
 * Runs only where GEMINI_API_KEY is available as a real environment variable:
 * the Vercel serverless function (api/ai.ts), the Vite dev middleware, and the
 * Node qa:* scripts. NEVER import this from client code — the browser talks to
 * it through services/AIService.ts, which calls the /api/ai gateway.
 *
 * Contract:
 * - Receives a NarrationContext (verified facts from the game engine)
 * - Returns atmospheric Watson-voice prose (markdownOutput only)
 * - NEVER returns state mutations (no newLocationId, inventoryUpdate, npcMutations, etc.)
 * - Optionally returns npcMemoryUpdate (short summaries for memory bank)
 *
 * The AI cannot hallucinate exits, NPCs, or items because it is not asked to track them.
 *
 * One narrow exception to "narration-only": resolveTargetObject() is a CONSTRAINED
 * target resolver. It maps a player's noun to one object id chosen from a SUPPLIED
 * list (the objects in the current location). Because it can only return an id from
 * that list (or null), it can never invent an object or grant a clue — the engine
 * still owns every clue and state decision. It returns a selection, never a mutation.
 */

import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import { NarrationContext, NarrationResponse, ActJournalSummary, TimePeriod, HintTarget, HintVerb, STIMEntry, ParseCandidates } from '../types.js';
import { ATMOSPHERIC_SEEDS } from '../engine/gameData.js';
import { ACT_ROMAN } from '../constants.js';
import { buildParseTools, buildParsePrompt, toolCallToIntent, type ToolCallOutcome } from './parseAction.js';

// ============================================================
// MODEL CONFIG
// ============================================================

// Overridable so a Google preview sunset or model swap is an env change,
// not a code change. The fallback is the current known-good model.
const MODEL_ID = process.env.GEMINI_MODEL_ID || 'gemini-3-flash-preview';

// ============================================================
// NARRATION SYSTEM PROMPT
// ============================================================

// Shared Holmes persona for the auxiliary (non-narration) calls. Carries the
// spoiler guard so neither the synthesis nor the hint can leak the killer's name.
const HOLMES_PERSONA_PROMPT =
  'You are Sherlock Holmes in 1888 London. Cold precision; no preamble, no pleasantries. ' +
  'Never name Edmund Halward or identify the killer directly before the final act.';

// System prompt for the Phase 3 tool-calling parse (constrained, non-narration).
const PARSE_ACTION_SYSTEM =
  "You translate a detective-game player's typed command into exactly one game action by calling a function. " +
  'Choose ids only from the declared parameter enums — never invent one. ' +
  'If the input is a question about the world, call no_action with reason "question". ' +
  'If it is atmospheric musing or not a command, use reason "atmospheric" or "unintelligible". ' +
  "Do not guess wildly: when no candidate genuinely matches the player's meaning, prefer no_action.";

// Dev-only prompt-size logger (token diet instrumentation).
// Enable with LOG_PROMPT_SIZES=1 (works in Vite and tsx — process.env is defined in both).
function logPromptSize(label: string, system: string, prompt: string): void {
  try {
    if (typeof process !== 'undefined' && process.env?.LOG_PROMPT_SIZES) {
      const sys = system.length;
      const usr = prompt.length;
      // ~4 chars/token heuristic
      console.debug(
        `[prompt-size] ${label}: system=${sys}ch (~${Math.round(sys / 4)}tok) ` +
        `user=${usr}ch (~${Math.round(usr / 4)}tok) total≈${Math.round((sys + usr) / 4)}tok`
      );
    }
  } catch { /* never let instrumentation break narration */ }
}

// Slimmed system prompt (token diet): mode instructions live in the per-call
// prompt (buildNarrationPrompt) — they were previously duplicated here. The
// Baker Street register and reconstruction guidance are injected per-call via
// the temporal section, only when relevant. Keep this string STATIC (no
// interpolation) so Gemini's implicit prefix caching applies.
const NARRATION_SYSTEM_PROMPT = `You narrate "London Bleeds: The Whitechapel Diaries" — a Victorian detective mystery, London, 1888. You write solely as Dr. John H. Watson in Arthur Conan Doyle's style: first-person past tense, analytical, restrained, quietly emotional. You are a narrator, not a game engine.

ABSOLUTE RULES:
1. VERIFIED STATE ONLY — never invent exits, items, characters, locations, or scenery/props (furniture, fixtures, objects, apparatus) beyond what the context lists. Holmes's case-map and its coloured threads exist only at Baker Street — never place that map, those threads, or any other unlisted prop in a location where it is not given. The reverse also holds: never narrate that Watson cannot leave, has no exits, or that "departure is out of the question" when the verified exits list is non-empty.
2. TIME — match the verified time of day exactly (no morning bustle at night; no gas-lit darkness at noon).
3. VOICE — first-person PAST TENSE, always, in every mode. Military doctor: medical and forensic specificity, measured authority, never melodramatic. State an emotion or sensation once; do not amplify or explain it — end the sentence before the elaboration. Occasionally dry; not every moment is dark. VARY YOUR OPENINGS — do not begin with fog, weather, or windows more than rarely; open instead on people, actions, objects, sounds, or Watson's thoughts. NEVER open with "I returned to…". OVER-USED IMAGERY (each may appear at most once per act): fire crackling in the grate/hearth, dancing or flickering shadows, fog pressing at the panes, "wreathed in smoke", "silhouetted against". BANNED PHRASE: "a profound sense of [emotion]" — show feeling through observed physical detail, never a labeled abstraction. Prefer fresh sensory channels — sound, smell, touch, small human details.
4. ALIASES (critical) — each NPC carries a label and an isIntroduced flag. If isIntroduced is false, use ONLY the label; never the real name, even in Watson's private thoughts. Bond's assistant is never introduced by anyone and never introduces himself — his name appears only via the forensic note. Until then: "Bond's assistant" or "the quiet young man", background only, never initiating.
5. HOLMES — at most one brief, cryptic observation per FULL turn. He never accuses the assistant before Act VI.
6. NO RAW LISTS — weave exits, objects, and people into prose.
7. BLOCKED ACTIONS — narrate the attempt failing in character; never "invalid command."
8. CLUES — weave discoveries naturally into the prose; never quote a clue title literally.
9. DEDUCTIONS — correct: Holmes agrees and notes the want of legal proof. If the result note says COLD CASE: write a ~150-word sombre diary epilogue — Watson closes the case unsolved and shuts his diary.
10. REGISTER — follow the TEMPORAL FRAMING note in each prompt (present = live investigation; reconstruction = cold scene worked from written reports), plus any register note it carries (e.g. the Baker Street sanctuary).

OUTPUT — return a JSON object:
- "markdownOutput": the narrative text (Markdown, real line breaks — never a literal "\\n"). Full mode max 160 words (110 on a revisit); compact mode max 130.
- "npcMemoryUpdate": optional ~10-word interaction summary keyed by npcId (e.g. {"holmes": "Watson and Holmes discussed the burned clothing."}).
- "stimUpdate": optional array of NEW sensory first-observations to remember, each {"key": snake_case id, "summary": "10-15 words", "scope": "npc"|"object"|"environment"} (e.g. {"key":"holmes_coat","summary":"...","scope":"npc"}). Only when the result note asks for it and the subject is not already in SESSION OBSERVATIONS.
NpcIds: holmes, abberline, bond, edmund, lusk, diemschutz, superintendent.`;

// ============================================================
// NARRATION RESPONSE SCHEMA (minimal — no state mutations)
// ============================================================

const NARRATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    markdownOutput: {
      type: Type.STRING,
      description: "Watson's first-person narrative prose. Markdown formatting. Full mode: max 160 words (110 on a revisit). Compact mode: max 130 words.",
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
    stimUpdate: {
      type: Type.ARRAY,
      description: 'Optional. New first-observation sensory details to remember. Each entry: a stable snake_case key (e.g. "holmes_coat"), a 10-15 word summary, and a scope. Omit or leave empty when no new observation was made.',
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: 'Stable snake_case id, e.g. "holmes_coat", "abberline_hands".' },
          summary: { type: Type.STRING, description: '10-15 word sensory description Watson noticed.' },
          scope: { type: Type.STRING, enum: ['npc', 'object', 'environment'] },
        },
        required: ['key', 'summary', 'scope'],
      },
    },
  },
  required: ['markdownOutput'],
};

// ============================================================
// PROMPT BUILDER
// ============================================================

function pickAtmosphericSeed(period: TimePeriod, weatherCondition: string, act: number): string {
  const isFoggy = weatherCondition === 'foggy';
  const candidates = ATMOSPHERIC_SEEDS.filter(
    s => (s.periods.length === 0 || s.periods.includes(period)) &&
         (!s.requiresFog || isFoggy) &&
         (!s.acts || s.acts.includes(act))
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
          .join('\n')}\nOccasionally a character may reference an earlier exchange unprompted — a half-sentence, in character, never expository.\n`
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

  const timeSection = `\nCURRENT TIME: ${ctx.timeLabel} (${ctx.timePeriod}). WEATHER: ${ctx.weather.label}. Your prose must be fully consistent with this time of day and this weather.\n`;
  // Register guidance moved out of the system prompt (token diet) — injected
  // here only when the relevant register applies.
  const bakerStreetNote = ctx.locationName.toLowerCase().includes('baker street')
    ? `\nREGISTER: 221B is sanctuary — domestic warmth, the familiar chaos of Holmes's method, the intellectual urgency of two men who trust each other. Not another grim location.\n`
    : '';
  const temporalSection = (ctx.locationTimeframe === 'reconstruction'
    ? `\nTEMPORAL FRAMING: RECONSTRUCTION — Watson revisits this cold crime scene weeks/months after the murder, working from Abberline's notes and Bond's written reports ("According to Abberline's report…"). Register: professional composure, retrospective sadness — observed, not flinched at; NOT live-investigation shock. Any blockquote must be a reconstructed memory or report detail, never a live ambient event.${ctx.locationReconstitutionNote ? `\nContext: ${ctx.locationReconstitutionNote}` : ''}\n`
    : `\nTEMPORAL FRAMING: PRESENT — Watson is here now, November 1888. Apply immediate, live-investigation register.\n`) + bakerStreetNote + timeSection;

  const atmosphericNoteSection = ctx.atmosphericNote
    ? `\n=== ATMOSPHERIC NOTE (use as basis for this examination — expand in Watson's voice) ===\n${ctx.atmosphericNote}\n`
    : '';

  // Verified acquisitions — the prose itself must convey that Watson now has it
  const itemsGainedSection = ctx.itemsGained && ctx.itemsGained.length > 0
    ? `\nWATSON ACQUIRED (verified): ${ctx.itemsGained.join(', ')}. Weave the act of taking/copying/clipping this into the prose — the player must understand from the narration itself that Watson now carries it.\n`
    : '';

  // Anti-repetition memory — the model's own recent opening sentences
  const recentOpeningsSection = ctx.recentOpenings && ctx.recentOpenings.length > 0
    ? `\nRECENT OPENING SENTENCES (yours — do NOT reuse their imagery, subjects, or sentence shape):\n${ctx.recentOpenings.map(o => `• ${o}`).join('\n')}\n`
    : '';

  // Hour-bell clock event — one passing clause, never a scene
  const clockEventSection = ctx.clockEvent ? `\nCLOCK EVENT: ${ctx.clockEvent}\n` : '';

  // Ambient extra — a background figure, strictly non-interactive
  const ambientExtraSection = ctx.ambientExtra
    ? `\nBACKGROUND FIGURE (non-interactive — they do not speak to Watson, he does not approach them; one observational clause only): ${ctx.ambientExtra}\n`
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
    const isRevisit = ctx.locationVisitCount > 1;
    const locationBlock = isRevisit
      ? `Location: ${ctx.locationName} — REVISIT (visit #${ctx.locationVisitCount}). Watson knows this room. HARD RULE: the opening sentence must be about Watson's purpose, the people present, or what is NEW — never the weather, the fog, the fire, the windows, or the furnishings. Do not describe the room's appearance at all unless something in it has physically changed. Readers have already seen this room described; repeating it reads as padding.`
      : `Location: ${ctx.locationName}
Atmosphere: ${ctx.locationAtmosphere}
Description: ${ctx.locationDescription}`;

    // FULL MODE — location arrival or look-around. Arrival: 3 tight paragraphs.
    // Revisit (look-around in a known room): 2 paragraphs, no re-description; a
    // blockquote only when an authored vignette is present (no atmospheric seed).
    const act0Note = ctx.act === 0
      ? '\nACT 0 PROLOGUE NOTE: This is Baker Street. Watson cannot leave yet — the exits list is empty because Holmes has not yet briefed him on where to begin. Do NOT invent exits or imply Watson is free to leave. Instead, let Holmes\'s presence and the case files naturally draw Watson\'s attention. The prose should make the player feel that examining the case files wall is the natural first action.'
      : '';
    const noticeBeat = `WHAT WATSON NOTICES: In prose (not a list), mention who is present (using their exact labels), what objects catch his eye, and which directions he could go — using ONLY the verified data above.${ctx.availableExits.length === 0 ? '\nNo exits are available yet. Do NOT invent exits or directions. Omit the "directions" sentence entirely — focus only on who and what is present.' : ''}`;
    const blockquoteBeat = `BLOCKQUOTE: ${ctx.vignette
      ? `A ONE-TIME AUTHORED MOMENT — render this faithfully (light polish only, keep its content intact):\nVignette: "${ctx.vignette}"`
      : `A world micro-event that makes this place feel alive. Use the seed below as a starting point.\nSeed: "${pickAtmosphericSeed(ctx.timePeriod, ctx.weather.condition, ctx.act)}"`}
Format EXACTLY as a Markdown blockquote:
> *Your world event sentence here.*`;

    const lengthLine = isRevisit
      ? 'Write 2 short paragraphs (max 110 words).'
      : 'Write 3 short paragraphs (max 160 words).';

    // Revisit keeps the authored vignette as an extra quoted beat when present,
    // but never invents an atmospheric-seed blockquote (keeps look-arounds tight).
    const structure = isRevisit
      ? `Paragraph 1 — RETURN: Watson's purpose in returning, or what is immediately different — NO room description, NO weather opener — ending with one brief clause of his reflection on the case.${act0Note}
${ctx.vignette ? `\n${blockquoteBeat}\n` : ''}
Paragraph 2 — ${noticeBeat}`
      : `Paragraph 1 — ATMOSPHERE: Vivid sensory description (apply the temporal register above), ending with one clause of Watson's reflection on the case or his unease.${act0Note}

Paragraph 2 — ${blockquoteBeat}

Paragraph 3 — ${noticeBeat}`;

    return `=== NARRATION MODE: FULL ===
${lengthLine} Begin with: ### ${actHeader}: ${ctx.actName}
${temporalSection}
=== VERIFIED LOCATION ===
${locationBlock}

NPCs present (verified — use their labels EXACTLY, respect alias rules): ${npcLabelList}
Objects Watson can examine (verified): ${ctx.availableObjects.length > 0 ? ctx.availableObjects.join(', ') : 'None'}
Exits Watson can take (verified): ${ctx.availableExits.length > 0 ? ctx.availableExits.join(', ') : 'None'}

Watson's state — Medical: ${ctx.watsonStats.medicalPoints}pts | Moral: ${ctx.watsonStats.moralPoints}pts
Watson's inventory: ${ctx.inventory.length > 0 ? ctx.inventory.join(', ') : 'empty'}
${memorySection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${itemsGainedSection}${recentOpeningsSection}${clockEventSection}${ambientExtraSection}${clueSection}${synthesisSection}
Narrate Watson's arrival / survey of this location using exactly this structure:

${structure}`;
  }

  // COMPACT MODE — examine, talk, take, use, inventory, deduce, blocked action
  const compactWordLimit = ctx.blockquoteHint !== 'none' ? 130 : 100;
  let compactPrompt = `=== NARRATION MODE: COMPACT ===
Write 2 short paragraphs separated by a blank line (max ${compactWordLimit} words total) — unless the response is a single brief sentence (e.g. a blocked action), which stays one line. NO act header. NO location description. NO exits listing.
${temporalSection}
=== VERIFIED CONTEXT ===
Location: ${ctx.locationName} (Act ${ctx.act}: ${ctx.actName})
NPCs present (use labels exactly): ${npcLabelList}
Scenery here (verified — the only objects/props present; do not introduce any others): ${ctx.availableObjects.length > 0 ? ctx.availableObjects.join(', ') : 'None'}
Watson's inventory (verified — never narrate him lacking or searching for these): ${ctx.inventory.length > 0 ? ctx.inventory.join(', ') : 'empty'}
${memorySection}${atmosphericNoteSection}
=== ACTION ===
${ctx.actionDescription}
Result: ${ctx.actionResultNote}
${itemsGainedSection}${recentOpeningsSection}${clockEventSection}${clueSection}${synthesisSection}`;

  if (ctx.targetNpcInterview) {
    const { label, isIntroduced, introducingThisTurn, realName, role, speakingStyle, personality, knowledgeEnvelope, playerQuestion } = ctx.targetNpcInterview;
    const nameInstruction = isIntroduced
      ? `Watson is speaking with: ${label} (${role})`
      : introducingThisTurn
      ? `Watson is speaking with: ${label} (${role}) — until this moment a stranger whose name Watson did not know. THIS IS THE TURN HE COMES FORWARD AND GIVES HIS NAME. Have him state his name, "${realName}", naturally in his own dialogue near the start of his reply (e.g. "${realName}, sir — ..."). Only after he has spoken it may the narration use "${realName}"; Watson registers it as he hears it. Do not have Watson know the name before it is said aloud.`
      : `Watson is speaking with: ${label} — their real name is unknown to Watson. Refer to them only as "${label}" throughout.`;
    // Token diet: cap the knowledge envelope at 8 items, preferring those that
    // overlap the player's question (simple keyword match), falling back to
    // the author-ordered head of the list.
    const MAX_ENVELOPE_ITEMS = 8;
    let envelopeItems = knowledgeEnvelope;
    if (knowledgeEnvelope.length > MAX_ENVELOPE_ITEMS) {
      const qWords = playerQuestion.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const scored = knowledgeEnvelope.map((fact, idx) => ({
        fact,
        idx,
        score: qWords.reduce((s, w) => s + (fact.toLowerCase().includes(w) ? 1 : 0), 0),
      }));
      envelopeItems = scored
        .sort((a, b) => b.score - a.score || a.idx - b.idx)
        .slice(0, MAX_ENVELOPE_ITEMS)
        .sort((a, b) => a.idx - b.idx) // restore author order for coherence
        .map(e => e.fact);
    }
    compactPrompt += `
=== NPC INTERVIEW ===
${nameInstruction}
Speaking style: ${speakingStyle}
Personality: ${personality.join(', ')}
Watson's question / statement: "${playerQuestion}"

WHAT THIS CHARACTER KNOWS (hard ceiling — do not invent facts beyond this list):
${envelopeItems.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Structure the reply as 2–3 short paragraphs separated by blank lines, for legibility:
- Paragraph 1: a brief framing clause and the character's spoken response in dialogue. Break a long speech into two paragraphs at a natural pause rather than one dense block.
- Final paragraph: Watson's brief reaction, on its own line.
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
Narrate only this specific action, broken into 2 short paragraphs separated by a blank line for legibility (a trivial blocked action may stay a single line). If talking: the NPC's spoken response as the first paragraph, then Watson's reaction as the second. If examining: Watson's direct observation, then its forensic implication or his reflection. If blocked: why Watson could not proceed, in character.`;

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

  if (ctx.watsonHint) {
    const h = ctx.watsonHint;
    const place = h.isCurrentLocation ? 'here' : `at ${h.locationName}`;
    const realisation =
      h.verb === 'reflect'
        ? `weighed ${h.subject}`
        : h.verb === 'travel'
        // Location not yet visited — direct Watson there without naming its contents.
        ? `made his way to ${h.locationName} (he has not been there yet and cannot know what it holds — do NOT describe its contents)`
        : `pursued ${h.subject} (${place})`;
    compactPrompt += `

=== WATSON'S THOUGHT (mandatory — append as the final paragraph) ===
Watson has spent several turns without progress. As the closing paragraph, add ONE brief private reflection (2–3 sentences, first person, past tense) in which he realises he has not yet ${realisation}.
Name the avenue plainly so the reader knows what to do next. Do NOT reveal what it will show, and do NOT name the murderer. No act header.`;
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
  // Lazy so importing this module (tsc, vite ssrLoadModule, qa scripts that
  // never hit the API) doesn't throw when the key is absent.
  private aiInstance: GoogleGenAI | null = null;

  private get ai(): GoogleGenAI {
    if (!this.aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is missing from the server environment.');
      }
      this.aiInstance = new GoogleGenAI({ apiKey });
    }
    return this.aiInstance;
  }

  /**
   * Connectivity check — a minimal generation that proves the key and model
   * are live. Replaces the legacy services/geminiService.ts ping.
   */
  async ping(): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: "Say 'ok'" }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text?.trim() || '';
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
    logPromptSize(`narration/${ctx.narrationMode}`, NARRATION_SYSTEM_PROMPT, prompt);

    const responseStream = await this.ai.models.generateContentStream({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: NARRATION_SYSTEM_PROMPT,
        thinkingConfig: { thinkingBudget: 256 }, // Narration is stylistic, not reasoning — minimal budget
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

    // The schema expresses stimUpdate as an array (Gemini structured output
    // cannot describe an arbitrary-key map); the rest of the app consumes it as
    // a Record<key, STIMEntry>. Normalize here. turnCreated is set by the
    // consumer, so 0 is a placeholder.
    const rawStim = parsed.stimUpdate as unknown;
    if (Array.isArray(rawStim)) {
      const record: Record<string, STIMEntry> = {};
      for (const e of rawStim as Array<{ key?: string; summary?: string; scope?: STIMEntry['scope'] }>) {
        if (e?.key && e.summary && e.scope) {
          record[e.key] = { summary: e.summary, scope: e.scope, turnCreated: 0 };
        }
      }
      parsed.stimUpdate = Object.keys(record).length > 0 ? record : undefined;
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
          `${HOLMES_PERSONA_PROMPT} Reason across the evidence: connect multiple clues and narrow the suspect profile with each new piece. Maximum 3 sentences.`,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim() || 'There is a pattern here, Watson. I am not yet ready to name it.';
  }

  /**
   * Non-streaming Watson-voiced hint. The engine has already chosen the target
   * (what to do next); Watson only phrases it. Directed but never spoils.
   */
  async getWatsonHint(target: HintTarget): Promise<string> {
    const where = target.isCurrentLocation
      ? 'It is here, where Watson already stands.'
      : `It is at ${target.locationName}; Watson would need to make his way there.`;

    const verbCue: Record<string, string> = {
      examine: 'look more closely at',
      talk: 'speak with',
      show: 'put before the right person',
      use: 'lay together and compare',
      deduce: 'draw his conclusion about',
      reflect: 'turn over again in his mind',
      travel: 'make his way to',
    };

    const focus =
      target.verb === 'reflect'
        ? `Watson senses he has gathered what this place can give, and should weigh ${target.subject}.`
        : target.verb === 'travel'
        // Location not yet visited: Watson cannot know its contents, so direct him
        // there only — never describe what waits inside.
        ? `Watson has not yet been to ${target.locationName}, and realises he ought to make his way there. He has no notion of what he will find — only that the place itself is the next step. Do NOT invent or describe its contents, and do NOT name or describe where Watson currently stands.`
        : `The avenue Watson has not yet pursued: ${verbCue[target.verb]} ${target.subject}. ${where}`;

    const prompt = `${focus}

Write Watson's private thought nudging himself toward this — first person, past tense, no more than 45 words. Name the avenue plainly so the reader knows what to do, but NEVER state what it will reveal or name the murderer. No preamble.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          `You are Dr. John Watson in 1888 London, writing in the first person, past tense. Restrained, observant, medical. You are recalling a moment when you realised what you had not yet done. One short reflection. Never reveal conclusions or the killer's identity.`,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim()
      || 'I realised there was still ground I had not covered, and resolved to put that right.';
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

  /**
   * Non-streaming call that fills in Watson's diary for a progression-gate flag
   * that has no hand-authored text (no clue trigger, no DECISION_DIARY entry).
   * Runs async, after the turn's narration has already completed — never blocks
   * the turn. `context` is deterministic, spoiler-safe, engine-supplied (reused
   * from the hint objective table); the AI only phrases it in Watson's voice,
   * grounded in what actually happened this turn.
   */
  async generateLeadDiaryEntry(context: {
    actName: string;
    verb: HintVerb;
    subject: string;
    narrationText: string;
  }): Promise<{ title: string; body: string }> {
    const verbCue: Record<string, string> = {
      examine: 'examined',
      talk: 'spoke with',
      show: 'showed',
      use: 'made use of',
      deduce: 'drew his conclusion about',
      reflect: 'turned over in his mind',
      travel: 'made his way to',
    };

    const prompt = `Watson has just ${verbCue[context.verb] || 'attended to'} ${context.subject}, during Act "${context.actName}".

What actually happened, in the turn's narration:
${context.narrationText}

Write a short diary entry recording this. First-person past tense, Watson's voice. A short evocative title (3-6 words, like a diary heading, no ending punctuation) and a body of 1-2 sentences. Ground the body in the narration above — do not invent details it doesn't contain. Never state a conclusion or name a suspect.`;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction:
            "You are Dr. John H. Watson recording a private diary entry. First-person past tense. Reflective, understated, historically authentic Victorian prose. Never reveal conclusions or the killer's identity.",
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'A short evocative diary heading, 3-6 words.' },
              body: { type: Type.STRING, description: "Watson's diary prose, 1-2 sentences." },
            },
            required: ['title', 'body'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return {
        title: (parsed.title || '').trim(),
        body: (parsed.body || '').trim(),
      };
    } catch {
      return { title: '', body: '' };
    }
  }

  /**
   * Constrained target resolver (NOT narration). Runs only when the deterministic
   * parser fails to land a player's noun on an object that is actually present.
   * Picks the intended object from the SUPPLIED candidate list (the current
   * location's objects) by meaning — synonyms, paraphrase, description. The result
   * is validated against the list, so it can never return an invented id; { objectId:
   * null } means "no confident match" and the caller keeps the original behaviour.
   * Never throws into the turn loop.
   */
  async resolveTargetObject(
    rawInput: string,
    intentType: string,
    candidates: Array<{ id: string; name: string }>,
    entityNoun: 'object' | 'person' = 'object',
  ): Promise<{ objectId: string | null }> {
    if (candidates.length === 0) return { objectId: null };

    const plural = entityNoun === 'person' ? 'people' : 'objects';
    const list = candidates.map(c => `- ${c.id} — "${c.name}"`).join('\n');
    const prompt = `The player typed: "${rawInput}" (action: ${intentType}).
Which of these ${plural} in the current scene did they most likely mean?
${list}

Reply with the matching id, or "none" if the phrase clearly refers to no ${entityNoun} in the list. Only match when the meaning genuinely corresponds — do not guess wildly.`;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction:
            `You map a player's phrase to exactly one ${entityNoun} id from a fixed list, by meaning (synonyms, paraphrase, ${entityNoun === 'person' ? 'role or description' : 'physical description'}). Return one id verbatim from the list, or "none". Never invent an id.`,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              objectId: { type: Type.STRING, description: 'A candidate id copied verbatim, or "none".' },
            },
            required: ['objectId'],
          },
        },
      });
      const picked = (JSON.parse(response.text || '{}').objectId ?? '').trim();
      const match = candidates.find(c => c.id === picked);
      return { objectId: match ? match.id : null };
    } catch {
      return { objectId: null };
    }
  }

  /**
   * Phase 3 tool-calling parse (NOT narration) — the same constrained contract
   * as resolveTargetObject, generalised to every verb. Maps a missed player
   * input to one validated ParsedIntent via forced function calling; every
   * argument is enum-locked to the client-supplied candidate lists and
   * re-validated in toolCallToIntent. Never throws into the turn loop.
   */
  async parseAction(rawInput: string, candidates: ParseCandidates): Promise<ToolCallOutcome> {
    try {
      const prompt = buildParsePrompt(rawInput, candidates);
      logPromptSize('parseAction', PARSE_ACTION_SYSTEM, prompt);
      const response = await this.ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: PARSE_ACTION_SYSTEM,
          thinkingConfig: { thinkingBudget: 0 },
          tools: [{ functionDeclarations: buildParseTools(candidates) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
        },
      });
      const call = response.functionCalls?.[0];
      if (!call) return { intent: null, invalidArgs: false };
      return toolCallToIntent(
        call.name,
        (call.args ?? {}) as Record<string, unknown>,
        candidates,
        rawInput,
      );
    } catch {
      return { intent: null, invalidArgs: false };
    }
  }
}

// Singleton export
export const aiService = new AIService();
