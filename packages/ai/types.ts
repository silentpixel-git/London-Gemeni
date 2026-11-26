// The AI seam (plan §2.9). Two capabilities, each configured with its own
// provider and model. packages/engine never imports this; server/turn.ts and
// the QA scripts do.
import type { CandidateSet, NarrationContext, NarrationResult, Selection } from '../schema/index.js';

export interface SelectInput {
  /** The player's text, verbatim. */
  text: string;
  candidates: CandidateSet;
  /** The last few player lines, oldest first, for pronoun and ellipsis resolution ("open it"). */
  recentTexts: string[];
}

export type NarrationChunk =
  | { kind: 'text'; delta: string }
  | { kind: 'done'; result: NarrationResult };

export interface Ai {
  /** Pick a verb and targets from the Candidate Set, or answer flavour/none. Never invents an id. */
  select(input: SelectInput): Promise<Selection>;
  /** Stream prose for a resolved turn; the final chunk carries the parsed result with Observations. */
  narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk>;
}

/** Gemini models per job (AI_SELECT_MODEL / AI_NARRATE_MODEL). The key is read from env and never stored here. */
export interface AiConfig {
  selectModel: string;
  narrateModel: string;
  /** AI_RECORDINGS_DIR: with no GEMINI_API_KEY, replay JSON fixtures from here (recorded.ts). */
  recordingsDir?: string;
}

/**
 * What a provider adapter needs from the prompt layer. Prompt text is owned by
 * prompts.ts; adapters only transport it. responseSchema is a JSON Schema the
 * provider is asked to conform to; the adapter MUST still validate the reply
 * with the Zod schema (Selection / NarrationResult) and treat a failure as a
 * retry once, then as `{kind:'none'}` for select or an empty result for narrate.
 */
export interface PromptBundle {
  system: string;
  user: string;
  responseSchema: Record<string, unknown>;
  /** Hint for the adapter's generation settings. */
  temperature: number;
}
