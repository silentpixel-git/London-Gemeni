/**
 * scripts/qa-browser.ts — the Phase 4 acceptance check (docs/engine-rebuild-plan.md §4):
 * Acts 0–I of a Story played in the browser through the real UI, and the same
 * Investigation resumed in a second browser rendering identically.
 *
 * Everything real except the network edges: the Vite dev server serves the
 * actual app, Chromium runs the actual client, and every POST /api/turn is
 * answered by the actual server/turn.ts handleTurn (memory store; the stress
 * fixture, then the default Story's Act 0 played to an ending on a second dev
 * server with no Story pinned). Only these are stood in for, in-process:
 *   - Supabase auth and REST (a fake guest session; the investigations list)
 *   - the AI: a scripted selection per typed line (exact commands take the
 *     engine's own fast path) and a narrator that speaks the turn's Beats
 *     and Facts verbatim, so every check reads authored text.
 * No key, no Supabase project, no production code path special-cased.
 *
 *   npx tsx scripts/qa-browser.ts [--screens]     exit 1 on any FAIL
 * --screens writes screenshots to $QA_SCREENS_DIR (default: ./qa-screens).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { NarrationResult, Selection } from '../packages/schema/index.js';
import type { Ai } from '../packages/ai/types.js';
import { memoryStore } from '../server/investigationStore.js';
import { fileStoryLoader, handleTurn, type TurnDeps } from '../server/turn.js';

// Playwright is not a repo dependency: the cloud image ships it globally, and
// require (unlike import) resolves the global install. Typed loosely on purpose.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = any;
type BrowserContext = any;
const { chromium } = createRequire(import.meta.url)('playwright') as { chromium: any };
/* eslint-enable @typescript-eslint/no-explicit-any */

const PORT = 3123;
const ORIGIN = `http://localhost:${PORT}`;
const SUPABASE = 'https://qa.supabase.test';
const SCREENS = process.argv.includes('--screens') ? (process.env.QA_SCREENS_DIR ?? 'qa-screens') : null;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${ok || !detail ? '' : `\n       ${detail}`}`);
}

// ── The server, in-process ──────────────────────────────────────────────────

const SELECTIONS: Record<string, Selection> = {
  'ask the woman in oilskins about the barrels': { kind: 'intent', verb: 'ask', person: 'ines', topic: 'cargo_was_barrels' },
  "read the keeper's log": { kind: 'intent', verb: 'read', target: 'keeper_log' },
  'ask orrin about the cargo': { kind: 'intent', verb: 'ask', person: 'orrin', topic: 'cargo_was_barrels' },
  'open the tackle chest': { kind: 'intent', verb: 'open', target: 'tackle_chest' },
  'take the store key': { kind: 'intent', verb: 'take', target: 'store_key' },
  'read the oil cask': { kind: 'intent', verb: 'read', target: 'oil_cask' },
  // The Whitechapel Story's Act 0 (the app's default Story), the lost wager.
  'talk to holmes': { kind: 'intent', verb: 'talk', person: 'holmes' },
  'examine the old man': { kind: 'intent', verb: 'examine', target: 'street_soldier' },
  'ask holmes about the old man': { kind: 'intent', verb: 'ask', person: 'holmes', topic: 'holmes_soldier_grandchild' },
  'examine the clergyman': { kind: 'intent', verb: 'examine', target: 'street_clergyman' },
  'ask holmes about the clergyman': { kind: 'intent', verb: 'ask', person: 'holmes', topic: 'holmes_actor_reading' },
};
const ai: Ai = {
  async select(input) {
    const s = SELECTIONS[input.text];
    if (!s) throw new Error(`qa-browser: no scripted selection for ${JSON.stringify(input.text)}`);
    return s;
  },
  async *narrate(ctx) {
    const said = [...ctx.beats, ...ctx.facts.map(f => f.voice ?? f.statement)];
    const result: NarrationResult = { prose: said.join(' ') || 'Nothing comes of it.', observations: [] };
    yield { kind: 'text', delta: result.prose };
    yield { kind: 'done', result };
  },
};
const store = memoryStore();
const listed: Array<{ id: string; name: string; story_id: string; updated_at: string }> = [];
const deps: TurnDeps = {
  store: {
    ...store,
    async create(storyId, name, ownerId) {
      const r = await store.create(storyId, name, ownerId);
      listed.unshift({ id: r.id, name, story_id: storyId, updated_at: new Date().toISOString() });
      return r;
    },
  },
  ai,
  loadStory: fileStoryLoader([join('stories'), join('packages', 'schema', 'fixtures')]),
  ownerId: 'qa-guest',
  gate: () => ({ ok: true, inventions: [] }),
};

const GUEST = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', is_anonymous: true,
  app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
};
const SESSION = {
  access_token: 'qa-token', refresh_token: 'qa-refresh', token_type: 'bearer',
  expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user: GUEST,
};

let turnsServed = 0;
async function wire(context: BrowserContext, lastInvestigation?: string) {
  await context.addInitScript(([session, last]) => {
    localStorage.setItem('sb-qa-auth-token', session as string);
    if (last) localStorage.setItem('lb:lastInvestigation', last as string);
  }, [JSON.stringify(SESSION), lastInvestigation ?? ''] as const);
  await context.route('**/api/turn', async route => {
    const req = route.request();
    const res = await handleTurn(new Request(`${ORIGIN}/api/turn`, { method: 'POST', body: req.postData() ?? '' }), deps);
    const body = await res.text();
    turnsServed++;
    await route.fulfill({ status: res.status, contentType: 'application/x-ndjson', body });
  });
  await context.route(`${SUPABASE}/**`, async route => {
    const url = new URL(route.request().url());
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/auth/v1/user') return json(200, GUEST);
    if (url.pathname === '/auth/v1/token') return json(200, SESSION);
    if (url.pathname.startsWith('/auth/v1/')) return json(200, {});
    if (url.pathname === '/rest/v1/investigations') {
      if (route.request().method() === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        listed.splice(listed.findIndex(r => r.id === id), 1);
        return route.fulfill({ status: 204, body: '' });
      }
      return json(200, listed);
    }
    return json(200, []);
  });
}

// ── The page ────────────────────────────────────────────────────────────────

const feedText = (page: Page) => page.locator('div.max-w-3xl.mx-auto').nth(1).innerText();
const sidebarText = (page: Page) => page.locator('aside[aria-label="Case sidebar"]').innerText();

async function settle(page: Page) {
  // A turn is done when the server has answered and the feed has stopped changing.
  let last = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const now = await feedText(page);
    if (now === last && !(await page.getByText(/\.\.\.$/).first().isVisible().catch(() => false))) return;
    last = now;
  }
}

async function say(page: Page, text: string) {
  const before = turnsServed;
  const input = page.locator('form input[type="text"]');
  await input.fill(text);
  await input.press('Enter');
  for (let i = 0; i < 100 && turnsServed === before; i++) await page.waitForTimeout(50);
  await settle(page);
}

async function shot(page: Page, name: string) {
  if (!SCREENS) return;
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: join(SCREENS, `${name}.png`) });
}

// ── Run ─────────────────────────────────────────────────────────────────────

/** A Vite dev server on `port`; `defaultStory` pins VITE_DEFAULT_STORY, or leaves the app's own default when undefined. */
async function startVite(port: number, defaultStory: string | undefined): Promise<() => void> {
  const env: Record<string, string | undefined> = { ...process.env, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_ANON_KEY: 'qa-anon', VITE_DEFAULT_STORY: defaultStory };
  if (defaultStory === undefined) delete env.VITE_DEFAULT_STORY;
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group, so stopping it also stops the vite under npx.
    detached: true,
  });
  // Drain the pipes (a full pipe stalls the server); keep the tail for a failure report.
  let viteLog = '';
  const keepLog = (d: Buffer) => { viteLog = (viteLog + d.toString()).slice(-8000); };
  vite.stdout.on('data', keepLog);
  vite.stderr.on('data', keepLog);
  vite.on('exit', code => { if (code !== null && code !== 0) console.error(`vite exited ${code}\n${viteLog}`); });
  const stopIt = () => { try { process.kill(-vite.pid!, 'SIGTERM'); } catch { /* gone */ } };
  process.on('exit', stopIt);
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://localhost:${port}`)).ok) break; } catch { /* not up yet */ }
    if (i > 120) { console.error('vite did not start'); process.exit(1); }
    await new Promise(r => setTimeout(r, 500));
  }
  return stopIt;
}
const stop = await startVite(PORT, 'stress');
let stopAct0 = () => {};

const browser = await chromium.launch();
try {
  const a = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await wire(a);
  const pageA = await a.newPage();
  const errors: string[] = [];
  pageA.on('pageerror', e => errors.push(String(e)));
  await pageA.clock.install();
  await pageA.goto(ORIGIN);

  const modal = pageA.getByRole('dialog').filter({ hasText: 'Investigations' });
  await modal.waitFor({ timeout: 15000 });
  check('first visit: the investigations list opens, with nothing to close it', await modal.isVisible() && !(await modal.getByRole('button', { name: /close/i }).isVisible().catch(() => false)));
  check('a guest is told how to keep their investigations', await modal.getByText(/Playing as a guest/).isVisible());
  await modal.locator('input').fill('Saltmarsh run');
  await modal.getByRole('button', { name: /begin/i }).click();
  await pageA.getByText('The relief boat leaves you').first().waitFor({ timeout: 15000 });
  await settle(pageA);
  check('the opening is narrated in the feed, headed by its act and location',
    (await feedText(pageA)).includes('The Jetty') && (await feedText(pageA)).includes('The relief boat leaves you'));
  check('the sidebar shows the opening location, people and exits from the view',
    /The Jetty/.test(await sidebarText(pageA)) && /The Keepers' Kitchen/.test(await sidebarText(pageA)));
  await shot(pageA, '1-opening');

  // Act 0
  await say(pageA, 'kitchen');
  check('an exact command (an exit name) moves the player', /The Keepers' Kitchen/.test((await sidebarText(pageA)).split('\n').slice(0, 3).join(' ')));
  check('a person is listed by alias until introduced', (await sidebarText(pageA)).includes('the woman in oilskins'));
  await say(pageA, 'ask the woman in oilskins about the barrels');
  check('the player line and the answer both reach the feed', (await feedText(pageA)).includes('ask the woman in oilskins about the barrels'));
  await say(pageA, "read the keeper's log");
  const act1Feed = await feedText(pageA);
  check('reading the log enters act 1: the feed carries the new act heading', /THE KITCHEN|The Kitchen/.test(act1Feed), act1Feed.slice(-400));
  check('the document introduction names her in the sidebar', (await sidebarText(pageA)).includes('Ines Tarrow'), await sidebarText(pageA));
  await shot(pageA, '2-act1');

  // Act I
  for (const line of ['jetty', 'ask orrin about the cargo', 'open the tackle chest', 'take the store key']) await say(pageA, line);
  check('act 1 play: the store key, taken from the opened chest, is carried', (await sidebarText(pageA)).includes('store key'), await sidebarText(pageA));
  for (const line of ['kitchen', 'store']) await say(pageA, line);
  check('…and entering the oil store snaps it into the lock (a Rule takes it)', !(await sidebarText(pageA)).includes('store key'));
  await say(pageA, 'read the oil cask');
  if (process.env.QA_DEBUG) {
    for (const e of (await store.load(listed[0].id))!.events) {
      const k = e.payload.kind;
      if (k === 'TurnReceived' || k === 'IntentRejected' || k === 'IntentSelected' || k === 'OpenBlocked' || k === 'Opened' || k === 'Taken') console.log('   ', e.turn, JSON.stringify(e.payload));
    }
  }
  check('no page errors while playing', errors.length === 0, errors.join('\n'));

  // The diary
  await pageA.getByRole('button', { name: /diary/i }).first().click();
  const diary = pageA.getByRole('dialog').filter({ hasText: 'Diary' });
  await diary.waitFor();
  await diary.getByRole('tab', { name: /evidence/i }).click().catch(async () => { await diary.getByText('Evidence').first().click(); });
  await pageA.waitForTimeout(200);
  const diaryText = await diary.innerText();
  check('the diary lists the clues found, by name', /clue|Crane|Oil/i.test(diaryText) && !diaryText.includes('No evidence yet'), diaryText.slice(0, 400));
  await shot(pageA, '3-diary');
  await pageA.keyboard.press('Escape');
  await pageA.waitForTimeout(300);

  const id = listed[0].id;
  const finalA = await feedText(pageA);
  const sideA = await sidebarText(pageA);

  // A second browser on the same Investigation
  const b = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await wire(b, id);
  const pageB = await b.newPage();
  if (process.env.QA_DEBUG) {
    pageB.on('console', (m: { text(): string }) => console.log('   B console:', m.text()));
    pageB.on('pageerror', (e: unknown) => console.log('   B error:', String(e)));
  }
  await pageB.goto(ORIGIN);
  if (process.env.QA_DEBUG) { await pageB.waitForTimeout(4000); console.log('   B body:', (await pageB.locator('body').innerText()).slice(0, 600)); }
  await pageB.getByText('The relief boat leaves you').first().waitFor({ timeout: 15000 });
  await settle(pageB);
  check('a second browser resumes the investigation and renders the feed identically', (await feedText(pageB)) === finalA,
    `A ${finalA.length} chars, B ${(await feedText(pageB)).length} chars`);
  check('…and the sidebar identically', (await sidebarText(pageB)) === sideA);
  await shot(pageB, '4-second-browser');

  // Reload in the first browser: resume, not a new game
  await pageA.reload();
  await pageA.getByText('The relief boat leaves you').first().waitFor({ timeout: 15000 });
  await settle(pageA);
  check('a reload resumes the same investigation, identical feed', (await feedText(pageA)) === finalA);

  // Idle Ticks
  const ticksBefore = (await store.load(id))!.events.filter(e => e.payload.kind === 'TickResolved').length;
  await pageA.clock.fastForward(130_000);
  for (let i = 0; i < 40 && turnsServed > 0; i++) {
    if ((await store.load(id))!.events.filter(e => e.payload.kind === 'TickResolved').length > ticksBefore) break;
    await pageA.waitForTimeout(100);
  }
  const ticksAfter = (await store.load(id))!.events.filter(e => e.payload.kind === 'TickResolved').length;
  check('two idle minutes with no input send one Tick', ticksAfter === ticksBefore + 1, `${ticksBefore} → ${ticksAfter}`);

  // ── The default Story: Act 0 played to an ending (no Story pinned) ──
  const PORT2 = PORT + 1;
  stopAct0 = await startVite(PORT2, undefined);
  const c = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await wire(c);
  const pageC = await c.newPage();
  const errorsC: string[] = [];
  pageC.on('pageerror', e => errorsC.push(String(e)));
  await pageC.goto(`http://localhost:${PORT2}`);
  const modalC = pageC.getByRole('dialog').filter({ hasText: 'Investigations' });
  await modalC.waitFor({ timeout: 15000 });
  await modalC.locator('input').fill('Act 0 run');
  await modalC.getByRole('button', { name: /begin/i }).click();
  await pageC.getByText('The August Bank Holiday').first().waitFor({ timeout: 15000 });
  await settle(pageC);
  check('the default Story is the Whitechapel Story: a new game opens on Act 0 in Baker Street',
    listed[0].story_id === 'whitechapel_1888' && /221B Baker Street/.test(await sidebarText(pageC)) && /Sherlock Holmes/.test(await sidebarText(pageC)), listed[0].story_id);
  for (const line of ['talk to holmes', 'talk to holmes', 'examine the old man', 'ask holmes about the old man', 'examine the clergyman', 'ask holmes about the clergyman', 'look', 'look']) await say(pageC, line);
  check('Act 0 played through the lost wager ends the game: the ending is in the feed', (await feedText(pageC)).includes('The Wager Lost'), (await feedText(pageC)).slice(-300));
  check('the ended game has no command line', (await pageC.locator('form input[type="text"]').count()) === 0);
  const again = pageC.getByRole('button', { name: 'Begin a new investigation' });
  check('…but the closed diary, and a button to begin a new investigation, which has the focus',
    await pageC.getByText('The diary is closed.').isVisible() && await again.isVisible()
    && await pageC.evaluate(() => document.activeElement?.textContent?.trim()) === 'Begin a new investigation');
  await shot(pageC, '5-act0-ended');
  await again.click();
  check('the button opens the investigations list', await modalC.isVisible());
  check('no page errors in Act 0', errorsC.length === 0, errorsC.join('\n'));
} finally {
  await browser.close();
  stop();
  stopAct0();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
