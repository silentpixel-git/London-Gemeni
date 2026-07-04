/**
 * server/parseAction.ts
 *
 * Pure logic for the Phase 3 tool-calling parse fallback: function
 * declarations built from candidate lists, the parse prompt, and validation
 * of the model's tool call back into a ParsedIntent. No Gemini client is
 * constructed here, so qa scripts can import the validators offline; the
 * model call itself lives in server/aiCore.ts (parseAction()).
 *
 * Contract: toolCallToIntent returns a SELECTION (an intent whose every id
 * came verbatim from the supplied candidate lists), never a mutation. An id
 * outside its list is rejected (intent: null, invalidArgs: true) — the QA
 * harness treats any invalidArgs as a hard failure.
 */

import { Type, type FunctionDeclaration } from '@google/genai';
import type { ParseCandidates } from '../types.js';
import type { ParsedIntent } from '../engine/intentParser.js';

const enumParam = (ids: string[], description: string) => ({
  type: Type.STRING,
  enum: ids,
  description,
});

export function buildParseTools(c: ParseCandidates): FunctionDeclaration[] {
  const objectIds = c.objects.map(o => o.id);
  const carriedIds = c.carried.map(o => o.id);
  const peopleIds = c.people.map(p => p.id);
  const locationIds = c.locations.map(l => l.id);
  const decls: FunctionDeclaration[] = [];

  if (locationIds.length > 0) {
    decls.push({
      name: 'move',
      description: 'Walk to another location in London.',
      parameters: {
        type: Type.OBJECT,
        properties: { destination: enumParam(locationIds, 'Where the player wants to go.') },
        required: ['destination'],
      },
    });
  }
  if (objectIds.length > 0) {
    decls.push({
      name: 'examine',
      description: 'Look closely at, search, or investigate an object in this scene or carried.',
      parameters: {
        type: Type.OBJECT,
        properties: { target: enumParam(objectIds, 'The object the player wants to inspect.') },
        required: ['target'],
      },
    });
    decls.push({
      name: 'take',
      description: 'Pick up or pocket an object in this scene.',
      parameters: {
        type: Type.OBJECT,
        properties: { object: enumParam(objectIds, 'The object to take.') },
        required: ['object'],
      },
    });
    decls.push({
      name: 'read',
      description: 'Read the text of a document in this scene or carried.',
      parameters: {
        type: Type.OBJECT,
        properties: { document: enumParam(objectIds, 'The document to read.') },
        required: ['document'],
      },
    });
    decls.push({
      name: 'use',
      description: 'Use or operate an object, optionally together with a second object.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          object: enumParam(objectIds, 'The object to use.'),
          with: enumParam(objectIds, 'Optional second object.'),
        },
        required: ['object'],
      },
    });
  }
  if (peopleIds.length > 0) {
    decls.push({
      name: 'talk',
      description: 'Speak with, question, or approach a person present in this scene.',
      parameters: {
        type: Type.OBJECT,
        properties: { person: enumParam(peopleIds, 'The person to address.') },
        required: ['person'],
      },
    });
  }
  if (carriedIds.length > 0) {
    if (peopleIds.length > 0) {
      decls.push({
        name: 'show',
        description: 'Show or hand a carried item to a person present.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            item: enumParam(carriedIds, 'The carried item to show.'),
            person: enumParam(peopleIds, 'Who to show it to.'),
          },
          required: ['item', 'person'],
        },
      });
    }
    decls.push({
      name: 'drop',
      description: 'Put down or discard a carried item.',
      parameters: {
        type: Type.OBJECT,
        properties: { item: enumParam(carriedIds, 'The carried item to drop.') },
        required: ['item'],
      },
    });
  }
  decls.push({
    name: 'deduce',
    description: "State a theory or accusation about the killer's identity.",
    parameters: { type: Type.OBJECT, properties: {} },
  });
  decls.push({
    name: 'no_action',
    description: 'The input is not a game action: a question about the world, atmospheric musing, or unintelligible.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          enum: ['question', 'atmospheric', 'unintelligible'],
          description: 'Why no action applies.',
        },
      },
      required: ['reason'],
    },
  });
  return decls;
}

export function buildParsePrompt(rawInput: string, c: ParseCandidates): string {
  const list = (xs: Array<{ id: string; name: string }>) =>
    xs.map(x => `- ${x.id} — "${x.name}"`).join('\n') || '(none)';
  return `The player (Dr Watson) typed: "${rawInput}"

People present:
${list(c.people)}

Objects here or carried:
${list(c.objects)}

Carried items:
${list(c.carried)}

Known locations:
${list(c.locations)}

Call exactly one function for what the player is trying to DO. Only match when the meaning genuinely corresponds — if no candidate fits, or the input is a question or pure atmosphere, call no_action.`;
}

export interface ToolCallOutcome {
  intent: ParsedIntent | null;
  // True when the model called an action tool with an id outside its enum
  // (or an unknown tool). The QA harness treats any of these as a hard failure.
  invalidArgs: boolean;
}

export function toolCallToIntent(
  name: string | undefined,
  args: Record<string, unknown>,
  c: ParseCandidates,
  rawInput: string,
): ToolCallOutcome {
  const pick = (xs: Array<{ id: string }>, v: unknown): string | null =>
    typeof v === 'string' && xs.some(x => x.id === v) ? v : null;
  const ok = (intent: ParsedIntent): ToolCallOutcome => ({ intent, invalidArgs: false });
  const invalid: ToolCallOutcome = { intent: null, invalidArgs: true };
  const base = { targetRaw: rawInput, raw: rawInput };

  switch (name) {
    case 'move': {
      const d = pick(c.locations, args.destination);
      return d ? ok({ type: 'move', targetId: d, ...base }) : invalid;
    }
    case 'examine': {
      const t = pick(c.objects, args.target);
      return t ? ok({ type: 'examine', targetId: t, ...base }) : invalid;
    }
    case 'take': {
      const t = pick(c.objects, args.object);
      return t ? ok({ type: 'take', targetId: t, ...base }) : invalid;
    }
    case 'read': {
      const t = pick(c.objects, args.document);
      return t ? ok({ type: 'read', targetId: t, ...base }) : invalid;
    }
    case 'use': {
      const t = pick(c.objects, args.object);
      if (!t) return invalid;
      if (args.with === undefined) return ok({ type: 'use', targetId: t, ...base });
      const w = pick(c.objects, args.with);
      return w ? ok({ type: 'use', targetId: t, useWithTargetId: w, ...base }) : invalid;
    }
    case 'talk': {
      const p = pick(c.people, args.person);
      return p ? ok({ type: 'talk', targetId: p, ...base }) : invalid;
    }
    case 'show': {
      const i = pick(c.carried, args.item);
      const p = pick(c.people, args.person);
      return i && p
        ? ok({ type: 'show', targetId: i, showTargetNpcId: p, ...base })
        : invalid;
    }
    case 'drop': {
      const i = pick(c.carried, args.item);
      return i ? ok({ type: 'drop', targetId: i, ...base }) : invalid;
    }
    case 'deduce':
      return ok({ type: 'deduce', deductionText: rawInput, raw: rawInput });
    case 'no_action':
      return args.reason === 'question'
        ? ok({ type: 'query', targetRaw: rawInput, raw: rawInput })
        : { intent: null, invalidArgs: false };
    default:
      return invalid;
  }
}
