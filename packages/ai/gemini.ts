// Gemini adapter: transports a PromptBundle over @google/genai and validates
// the reply with Zod before it leaves. Adds no instructions of its own.
import { GoogleGenAI } from '@google/genai';
import { NarrationResult, Selection, type NarrationContext } from '../schema/index.js';
import { JudgeReply, buildJudgePrompt, buildNarratePrompt, buildSelectPrompt } from './prompts.js';
import { confineObservations, confineSelection, repairSelectionReply } from './selection.js';
import type { Ai, JudgeInput, NarrationChunk, PromptBundle, SelectInput } from './types.js';

export function gemini(selectModel: string, narrateModel: string, judgeModel: string, apiKey: string): Ai {
  const client = new GoogleGenAI({ apiKey });

  const request = (model: string, bundle: PromptBundle, limits: { maxOutputTokens?: number; abortSignal?: AbortSignal; thinkingConfig?: { thinkingBudget: number } } = {}) => ({
    model,
    contents: [{ role: 'user', parts: [{ text: bundle.user }] }],
    config: {
      systemInstruction: bundle.system,
      temperature: bundle.temperature,
      responseMimeType: 'application/json',
      responseJsonSchema: forGemini(bundle.responseSchema),
      ...limits,
    },
  });

  return {
    async judge(input: JudgeInput): Promise<boolean | null> {
      // One call, only on a turn that tells an answer. A small thinking budget: judging a claim against an answer is
      // a short decision, and the turn must stay inside the function's time.
      const req = request(judgeModel, buildJudgePrompt(input), {
        maxOutputTokens: JUDGE_MAX_TOKENS, abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS), thinkingConfig: { thinkingBudget: JUDGE_THINKING },
      });
      const res = await client.models.generateContent(req);
      const parsed = JudgeReply.safeParse(parseJson(res.text ?? ''));
      // A line about some other subject is no answer on this one: unjudged, so it commits nothing.
      return parsed.success && parsed.data.onSubject ? parsed.data.agrees : null;
    },

    async select(input: SelectInput): Promise<Selection> {
      for (let attempt = 0; attempt < 2; attempt++) {
        // A reply that runs on (a deduction listing every Fact, repeated) is cut short and, like one that takes
        // too long or fails, comes to none rather than holding the turn past the function's time.
        const req = request(selectModel, buildSelectPrompt(input), { maxOutputTokens: SELECT_MAX_TOKENS, abortSignal: AbortSignal.timeout(SELECT_TIMEOUT_MS) });
        const res = await client.models.generateContent(req).catch((err: unknown) => {
          console.warn('select failed:', err instanceof Error ? err.message : err);
          return null;
        });
        if (!res) continue;
        const parsed = Selection.safeParse(repairSelectionReply(parseJson(res.text ?? '')));
        if (parsed.success) return confineSelection(parsed.data, input.candidates, input.text);
      }
      return { kind: 'none', reason: 'no usable reply' };
    },

    async *narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk> {
      // A narration that has not finished in its time ends the turn's narration; the endpoint closes the turn with its Beats.
      // A bounded thinking budget: prose for one turn needs little planning, and default thinking ran into the timeout.
      const req = () => request(narrateModel, buildNarratePrompt(ctx), { abortSignal: AbortSignal.timeout(NARRATE_TIMEOUT_MS), thinkingConfig: { thinkingBudget: NARRATE_THINKING } });
      // Streaming design: the reply is the NarrationResult JSON, and `prose` is
      // the first property of the schema (Gemini emits properties in schema
      // order), so the prose string opens early. We decode that string from the
      // partial JSON as it grows and stream only the new suffix; observations
      // arrive after the prose closes and are read from the final parse. The
      // cost: escapes split across chunks hold a character back until the next
      // chunk, and if the model ever puts observations first, nothing streams
      // until the prose opens (the result is still correct, only later).
      for (let attempt = 0; attempt < 2; attempt++) {
        let raw = '';
        let sent = 0;
        const stream = await client.models.generateContentStream(req());
        for await (const chunk of stream) {
          raw += chunk.text ?? '';
          const prose = proseSoFar(raw);
          if (prose.length > sent) {
            yield { kind: 'text', delta: prose.slice(sent) };
            sent = prose.length;
          }
        }
        const parsed = NarrationResult.safeParse(parseJson(raw));
        if (parsed.success) {
          yield { kind: 'done', result: confineObservations(parsed.data, ctx) };
          return;
        }
        // Prose already streamed cannot be unsent; keep it rather than retry.
        const prose = proseSoFar(raw);
        if (prose.trim()) {
          yield { kind: 'done', result: { prose, observations: [] } };
          return;
        }
      }
      // types.ts: a second failure is an empty result; the endpoint falls back to the Beats.
      yield { kind: 'done', result: { prose: '', observations: [] } };
    },
  };
}

/**
 * Ceilings on each call. A turn's usual worst case is select twice 5 s, on a turn that tells an answer one judge call
 * of 7 s, and narrate 20 s twice (the gate may ask once more): 57 s of the function's 60 s (vercel.json), before
 * loading, replay and the appends. Rarer paths go past it (narrate's own retry on an unparsable reply, a lost race
 * for the next seq that selects again); a turn the platform cuts off is closed by stale-turn recovery (server/TURN.md)
 * (the gate may ask once more). A select model answers in about a second; narration is the long call. A Selection is a short object: 512 tokens assumes a select model that does not
 * think (the default, flash-lite); a thinking model would spend them before replying.
 */
const SELECT_MAX_TOKENS = 512;
const SELECT_TIMEOUT_MS = 5_000;
const NARRATE_TIMEOUT_MS = 20_000;
const JUDGE_TIMEOUT_MS = 7_000;
const JUDGE_MAX_TOKENS = 1_024;
const JUDGE_THINKING = 0;
const NARRATE_THINKING = 256;

/** Gemini's JSON-schema dialect rejects the $schema dialect marker Zod adds. */
function forGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _dialect, ...rest } = schema;
  return rest;
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

/**
 * The decoded value of the top-level "prose" string in partial JSON, as far as
 * it has arrived. Stops before an incomplete escape so a later call extends it.
 */
function proseSoFar(json: string): string {
  const key = /"prose"\s*:\s*"/.exec(json);
  if (!key) return '';
  let out = '';
  let i = key.index + key[0].length;
  while (i < json.length) {
    const c = json[i];
    if (c === '"') break;
    if (c !== '\\') { out += c; i++; continue; }
    const n = json[i + 1];
    if (n === undefined) break;
    if (n === 'u') {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    out += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[n] ?? n;
    i += 2;
  }
  return out;
}
