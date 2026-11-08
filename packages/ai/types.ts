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

export type ProviderName = 'gemini' | 'recorded';

export interface JobConfig { provider: ProviderName; model: string }

export interface AiConfig {
  select: JobConfig;
  narrate: JobConfig;
  /** For the 'recorded' provider: directory of JSON fixtures keyed by a hash of the input. */
  recordingsDir?: string;
}

/** Environment → config. AI_SELECT_MODEL / AI_NARRATE_MODEL / AI_SELECT_PROVIDER / AI_NARRATE_PROVIDER. */
export const ENV_KEYS = {
  selectProvider: 'AI_SELECT_PROVIDER',
  selectModel: 'AI_SELECT_MODEL',
  narrateProvider: 'AI_NARRATE_PROVIDER',
  narrateModel: 'AI_NARRATE_MODEL',
  geminiKey: 'GEMINI_API_KEY',
  recordingsDir: 'AI_RECORDINGS_DIR',
} as const;

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
