// Fixture adapter: replays JSON recordings keyed by a hash of the input, and
// `recording` writes them by wrapping a real provider. Lets the turn endpoint
// run end to end in QA with no key and no network.
//
// A recording is <dir>/<key>.json:
//   { "kind": "select",  "summary": "...", "selection": Selection }
//   { "kind": "narrate", "summary": "...", "result": NarrationResult }
// key = sha1 of the canonical JSON of {kind:'select', text, candidates} or
// {kind:'narrate', ctx}. recentTexts is left out of the select key: it only
// helps a live model with pronouns, and leaving it out keeps fixtures stable.
// Replay returns the stored Selection verbatim (schema-checked, not confined to
// the set), so the endpoint's own Candidate Set check is what QA exercises.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NarrationResult, Selection, type NarrationContext } from '../schema/index.js';
import type { Ai, NarrationChunk, SelectInput } from './types.js';

type Recording =
  | { kind: 'select'; summary: string; selection: Selection }
  | { kind: 'narrate'; summary: string; result: NarrationResult };

export function recorded(dir: string): Ai {
  const read = (key: string, summary: string): Recording => {
    const path = join(dir, `${key}.json`);
    if (!existsSync(path)) throw new Error(`recorded AI: no recording ${key} (${summary}) in ${dir}`);
    return JSON.parse(readFileSync(path, 'utf8')) as Recording;
  };
  return {
    async select(input: SelectInput): Promise<Selection> {
      const { key, summary } = selectKey(input);
      const rec = read(key, summary);
      if (rec.kind !== 'select') throw new Error(`recorded AI: ${key} is a ${rec.kind} recording, wanted select`);
      return Selection.parse(rec.selection);
    },
    async *narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk> {
      const { key, summary } = narrateKey(ctx);
      const rec = read(key, summary);
      if (rec.kind !== 'narrate') throw new Error(`recorded AI: ${key} is a ${rec.kind} recording, wanted narrate`);
      const result = NarrationResult.parse(rec.result);
      for (const delta of chunks(result.prose, 3)) yield { kind: 'text', delta };
      yield { kind: 'done', result };
    },
  };
}

/** Wraps a real provider and writes what it returns as recordings in `dir`. */
export function recording(inner: Ai, dir: string): Ai {
  const write = (key: string, rec: Recording) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${key}.json`), JSON.stringify(rec, null, 2) + '\n');
  };
  return {
    async select(input: SelectInput): Promise<Selection> {
      const selection = await inner.select(input);
      const { key, summary } = selectKey(input);
      write(key, { kind: 'select', summary, selection });
      return selection;
    },
    async *narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk> {
      for await (const chunk of inner.narrate(ctx)) {
        if (chunk.kind === 'done') {
          const { key, summary } = narrateKey(ctx);
          write(key, { kind: 'narrate', summary, result: chunk.result });
        }
        yield chunk;
      }
    },
  };
}

export function selectKey(input: SelectInput) {
  return { key: sha1({ kind: 'select', text: input.text, candidates: input.candidates }), summary: `select ${JSON.stringify(input.text)}` };
}

export function narrateKey(ctx: NarrationContext) {
  const kinds = ctx.events.map(e => e.kind).join(',') || 'no events';
  return { key: sha1({ kind: 'narrate', ctx }), summary: `narrate ${ctx.mode} at ${ctx.location.id}: ${kinds}` };
}

function sha1(value: unknown): string {
  return createHash('sha1').update(canonical(value)).digest('hex');
}

/** JSON with object keys sorted and undefined fields dropped, so equal inputs hash equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(v => canonical(v ?? null)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function chunks(text: string, n: number): string[] {
  const words = text.split(/(?<=\s)/);
  const size = Math.max(1, Math.ceil(words.length / n));
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(''));
  return out;
}
