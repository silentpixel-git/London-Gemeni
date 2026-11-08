// Gemini adapter: transports a PromptBundle over @google/genai and validates
// the reply with Zod before it leaves. Adds no instructions of its own.
import { GoogleGenAI } from '@google/genai';
import { NarrationResult, Selection, type NarrationContext } from '../schema/index.js';
import { buildNarratePrompt, buildSelectPrompt } from './prompts.js';
import { confineObservations, confineSelection } from './selection.js';
import type { Ai, JobConfig, NarrationChunk, PromptBundle, SelectInput } from './types.js';

export function gemini(select: JobConfig, narrate: JobConfig, apiKey: string): Ai {
  const client = new GoogleGenAI({ apiKey });

  const request = (model: string, bundle: PromptBundle) => ({
    model,
    contents: [{ role: 'user', parts: [{ text: bundle.user }] }],
    config: {
      systemInstruction: bundle.system,
      temperature: bundle.temperature,
      responseMimeType: 'application/json',
      responseJsonSchema: forGemini(bundle.responseSchema),
    },
  });

  return {
    async select(input: SelectInput): Promise<Selection> {
      const req = request(select.model, buildSelectPrompt(input));
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await client.models.generateContent(req);
        const parsed = Selection.safeParse(parseJson(res.text ?? ''));
        if (parsed.success) return confineSelection(parsed.data, input.candidates);
      }
      return { kind: 'none', reason: 'unparseable' };
    },

    async *narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk> {
      const req = request(narrate.model, buildNarratePrompt(ctx));
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
        const stream = await client.models.generateContentStream(req);
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
export function proseSoFar(json: string): string {
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
