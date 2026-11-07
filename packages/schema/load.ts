// Node-only loader: a Story directory is story.json (id, title, acts,
// opening, endings) plus one optional JSON file per collection. Kept apart
// from validate.ts so the schemas stay usable in the browser.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const COLLECTIONS = ['locations', 'objects', 'persons', 'facts', 'clues', 'rules'] as const;

export function loadStoryDir(dir: string): unknown {
  const storyPath = join(dir, 'story.json');
  if (!existsSync(storyPath)) throw new Error(`no story.json in ${dir}`);
  const raw = JSON.parse(readFileSync(storyPath, 'utf8')) as Record<string, unknown>;
  for (const name of COLLECTIONS) {
    const p = join(dir, `${name}.json`);
    if (existsSync(p)) raw[name] = JSON.parse(readFileSync(p, 'utf8'));
    else if (raw[name] === undefined) raw[name] = [];
  }
  return raw;
}
