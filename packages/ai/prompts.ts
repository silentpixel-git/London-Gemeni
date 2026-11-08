// Prompt construction for the two AI jobs. Owned by the prompt designer;
// adapters transport these bundles and never add instructions of their own.
//
// STATUS: placeholder bundles so the transport can be built and tested with
// the 'recorded' provider. The real prompts replace the bodies below without
// changing the signatures.
import { z } from 'zod';
import { NarrationResult, Selection, type NarrationContext } from '../schema';
import type { PromptBundle, SelectInput } from './types';

export function buildSelectPrompt(input: SelectInput): PromptBundle {
  return {
    system: 'You map a player\'s text onto exactly one of the offered candidates, or answer none/flavour. Reply as JSON.',
    user: JSON.stringify({ text: input.text, recent: input.recentTexts, candidates: input.candidates }),
    responseSchema: z.toJSONSchema(Selection),
    temperature: 0,
  };
}

export function buildNarratePrompt(ctx: NarrationContext): PromptBundle {
  return {
    system: 'You narrate exactly the events given, in the given word budget, and return JSON with prose and observations.',
    user: JSON.stringify(ctx),
    responseSchema: z.toJSONSchema(NarrationResult),
    temperature: 0.8,
  };
}
