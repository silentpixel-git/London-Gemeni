// Builds the Ai for a process from the environment: Gemini when GEMINI_API_KEY
// is set, otherwise the recorded fixtures in AI_RECORDINGS_DIR.
import { gemini } from './gemini.js';
import { recorded } from './recorded.js';
import type { Ai, AiConfig } from './types.js';

export * from './types.js';
export { gemini } from './gemini.js';
export { recorded, recording } from './recorded.js';
export { confineSelection } from './selection.js';

type Env = Record<string, string | undefined>;

export function configFromEnv(env: Env): AiConfig {
  return {
    selectModel: env.AI_SELECT_MODEL || 'gemini-2.5-flash-lite',
    narrateModel: env.AI_NARRATE_MODEL || 'gemini-2.5-flash',
    ...(env.AI_RECORDINGS_DIR ? { recordingsDir: env.AI_RECORDINGS_DIR } : {}),
  };
}

export function createAi(config: AiConfig, env: Env): Ai {
  if (env.GEMINI_API_KEY) return gemini(config.selectModel, config.narrateModel, env.GEMINI_API_KEY);
  if (config.recordingsDir) return recorded(config.recordingsDir);
  throw new Error('the AI needs GEMINI_API_KEY, or AI_RECORDINGS_DIR for recorded replies');
}
