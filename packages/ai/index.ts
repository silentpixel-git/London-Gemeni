// Builds the Ai for a process from config; config comes from the environment.
import { gemini } from './gemini.js';
import { recorded } from './recorded.js';
import { ENV_KEYS, type Ai, type AiConfig, type ProviderName } from './types.js';

export * from './types.js';
export { gemini } from './gemini.js';
export { recorded, recording } from './recorded.js';
export { confineSelection, inCandidateSet } from './selection.js';

type Env = Record<string, string | undefined>;

const DEFAULT_MODELS = { select: 'gemini-2.5-flash-lite', narrate: 'gemini-2.5-flash' };
const PROVIDERS: ProviderName[] = ['gemini', 'recorded'];

export function configFromEnv(env: Env): AiConfig {
  const fallback: ProviderName = env[ENV_KEYS.geminiKey] ? 'gemini' : 'recorded';
  const provider = (key: string): ProviderName => {
    const v = env[key];
    if (!v) return fallback;
    if (!PROVIDERS.includes(v as ProviderName)) throw new Error(`${key}=${v}: expected one of ${PROVIDERS.join(', ')}`);
    return v as ProviderName;
  };
  return {
    select: { provider: provider(ENV_KEYS.selectProvider), model: env[ENV_KEYS.selectModel] || DEFAULT_MODELS.select },
    narrate: { provider: provider(ENV_KEYS.narrateProvider), model: env[ENV_KEYS.narrateModel] || DEFAULT_MODELS.narrate },
    ...(env[ENV_KEYS.recordingsDir] ? { recordingsDir: env[ENV_KEYS.recordingsDir] } : {}),
  };
}

/** Each job gets its own provider; the key is read from env and never stored in config. */
export function createAi(config: AiConfig, env: Env): Ai {
  const build = (p: ProviderName): Ai => {
    if (p === 'gemini') {
      const key = env[ENV_KEYS.geminiKey];
      if (!key) throw new Error(`the gemini provider needs ${ENV_KEYS.geminiKey}`);
      return gemini(config.select, config.narrate, key);
    }
    if (!config.recordingsDir) throw new Error(`the recorded provider needs ${ENV_KEYS.recordingsDir}`);
    return recorded(config.recordingsDir);
  };
  const sel = build(config.select.provider);
  const nar = config.narrate.provider === config.select.provider ? sel : build(config.narrate.provider);
  return { select: input => sel.select(input), narrate: ctx => nar.narrate(ctx) };
}
