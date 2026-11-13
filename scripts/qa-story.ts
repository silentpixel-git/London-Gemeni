/**
 * scripts/qa-story.ts
 *
 * Build-blocking Story validation (plan §2.7, Phase 0). Three fixtures prove
 * the validator itself, then every directory under stories/ must pass.
 *
 *   fixtures/toy     a 3-room Story using every Trigger kind — must PASS
 *   fixtures/empty   `{}` — must FAIL (an empty Story does not build)
 *   fixtures/broken  the toy with three authored faults — must FAIL on each
 *
 * Run: npx tsx scripts/qa-story.ts     Exit 1 on any unexpected outcome.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateStory, type Issue } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string, d?: string) => { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; };
const show = (issues: Issue[]) => issues.forEach(i => console.log(`       ${i.level.toUpperCase().padEnd(4)} ${i.at}: ${i.message}`));

const FIXTURES = join('packages', 'schema', 'fixtures');

// 1. The toy Story builds.
{
  const r = validateStory(loadStoryDir(join(FIXTURES, 'toy')));
  if (r.ok) pass(`toy story validates (${r.issues.length} warning(s))`); else fail('toy story should validate');
  show(r.issues);
}

// 1b. The stress Story builds too (every Trigger and Effect kind, three acts).
{
  const r = validateStory(loadStoryDir(join(FIXTURES, 'stress')));
  if (r.ok) pass(`stress story validates (${r.issues.length} warning(s))`); else fail('stress story should validate');
  show(r.issues);
}

// 1c. An action Rule may name a person where the engine accepts one: examine <person>, use <object> on <person>.
{
  const raw = loadStoryDir(join(FIXTURES, 'stress')) as { rules: unknown[] };
  const beat = [{ kind: 'playBeat', beats: ['He looks tired.'] }];
  raw.rules.push(
    { id: 'qa_examine_person', trigger: { kind: 'action', verb: ['examine'], target: ['orrin'] }, once: true, effects: beat },
    { id: 'qa_use_on_person', trigger: { kind: 'action', verb: ['use'], target: ['tackle_chest'], secondary: ['orrin'] }, once: true, effects: beat },
    { id: 'qa_take_person', trigger: { kind: 'action', verb: ['take'], target: ['orrin'] }, once: true, effects: beat },
  );
  const about = (id: string) => validateStory(raw).issues.filter(i => i.at.startsWith(`rules/${id}/`));
  if (about('qa_examine_person').length === 0 && about('qa_use_on_person').length === 0) pass('examine <person> and use <object> on <person> Rules validate');
  else { fail('a person as examine target or use secondary must validate'); show([...about('qa_examine_person'), ...about('qa_use_on_person')]); }
  if (about('qa_take_person').some(i => i.level === 'fail')) pass('a person as the target of any other verb is still rejected');
  else fail('take <person> must not validate');
}

// 2. An empty Story does not.
{
  const r = validateStory(loadStoryDir(join(FIXTURES, 'empty')));
  if (!r.ok && r.issues.length > 0) pass(`empty story rejected with ${r.issues.length} issue(s)`); else fail('empty story must be rejected');
}

// 3. Each authored fault in the broken copy is named.
{
  const r = validateStory(loadStoryDir(join(FIXTURES, 'broken')));
  const expect: Array<[string, (i: Issue) => boolean]> = [
    ['dangling exit destination', i => i.level === 'fail' && i.at.startsWith('locations/study/exits') && i.message.includes('attic')],
    ['flag read but never set', i => i.level === 'fail' && i.message.includes('"never_set"')],
    ['lock flag never set', i => i.level === 'fail' && i.message.includes('"garden_unlocked"')],
    ['act 1 never entered', i => i.level === 'fail' && i.at === 'acts/1'],
  ];
  for (const [label, pred] of expect) {
    if (r.issues.some(pred)) pass(`broken story: ${label} detected`); else { fail(`broken story: ${label} NOT detected`); show(r.issues); }
  }
  if (r.ok) fail('broken story must not validate');
}

// 4. Every real Story.
if (existsSync('stories')) {
  for (const dir of readdirSync('stories', { withFileTypes: true }).filter(d => d.isDirectory())) {
    const r = validateStory(loadStoryDir(join('stories', dir.name)));
    if (r.ok) pass(`stories/${dir.name} validates (${r.issues.length} warning(s))`); else fail(`stories/${dir.name} does not validate`);
    show(r.issues);
  }
} else {
  console.log('       (no stories/ directory yet)');
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
