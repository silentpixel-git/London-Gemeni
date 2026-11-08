/**
 * scripts/smoke-gemini.ts
 *
 * One live select and one live narrate against the toy Story through the
 * Gemini adapter, printed for a human to read. Not part of qa:all: it needs
 * GEMINI_API_KEY and the network, and prints SKIP without the key.
 *
 *   npx tsx scripts/smoke-gemini.ts
 *
 * In a cloud session whose proxy injects the key, Node's fetch ignores
 * HTTPS_PROXY unless told otherwise, and Gemini answers "API key not valid":
 *   NODE_USE_ENV_PROXY=1 GEMINI_API_KEY=placeholder npx tsx scripts/smoke-gemini.ts
 */

import { join } from 'node:path';
import { Story } from '../packages/schema/index.js';
import { loadStoryDir } from '../packages/schema/load.js';
import { buildNarrationContext, candidates, initialState, resolveTurn } from '../packages/engine/index.js';
import { configFromEnv, createAi } from '../packages/ai/index.js';

if (!process.env.GEMINI_API_KEY) {
  console.log('SKIP smoke-gemini: GEMINI_API_KEY is not set');
  process.exit(0);
}

const story = Story.parse(loadStoryDir(join('packages', 'schema', 'fixtures', 'toy')));
const config = configFromEnv(process.env);
const ai = createAi({ ...config, select: { ...config.select, provider: 'gemini' }, narrate: { ...config.narrate, provider: 'gemini' } }, process.env);
const state = initialState(story, 42);

const text = 'have a look inside the grandfather clock';
const t0 = Date.now();
const selection = await ai.select({ text, candidates: candidates(story, state), recentTexts: [] });
console.log(`select (${config.select.model}, ${Date.now() - t0} ms): ${JSON.stringify(text)} →`, JSON.stringify(selection));

const turn = resolveTurn(story, state, { text, selection });
const ctx = buildNarrationContext(story, turn.state, turn.events, 'full');
const t1 = Date.now();
let first = 0;
process.stdout.write(`\nnarrate (${config.narrate.model}):\n`);
for await (const chunk of ai.narrate(ctx)) {
  if (chunk.kind === 'text') {
    first ||= Date.now() - t1;
    process.stdout.write(chunk.delta);
  } else {
    console.log(`\n\nfirst token ${first} ms, total ${Date.now() - t1} ms`);
    console.log('observations:', JSON.stringify(chunk.result.observations, null, 2));
  }
}
