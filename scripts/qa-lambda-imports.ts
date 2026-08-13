/**
 * scripts/qa-lambda-imports.ts
 *
 * Guards the ONE thing that separates the Vercel serverless function from every
 * other way this code runs: it is executed by native Node ESM, not a bundler.
 *
 * `api/ai.ts` is deployed as a Node function and Vercel transpiles it per file
 * rather than bundling — the lambda really does contain
 * /var/task/engine/stories/whitechapel-1888/acts.js and friends. Native ESM has
 * no extension resolution, so a relative import written the way a bundler
 * accepts it (`from '../../time'`) throws ERR_MODULE_NOT_FOUND at module load.
 * That takes down the whole function before a single request is served, which
 * is exactly what happened: every /api/ai call returned 500 while dev, `tsc`
 * and all the other qa:* suites stayed green, because Vite and tsx both resolve
 * extensionless specifiers happily.
 *
 * The rule enforced here, for every file reachable from api/ai.ts:
 *   a relative import is either fully type-only (erased before Node sees it)
 *   or it carries an explicit .js extension.
 *
 * Type-only-ness is read from the AST, so `import type { X }` passes while a
 * plain `import { X }` must be explicit even when X happens to be a type —
 * the transpiler drops types without a type checker, so relying on elision is
 * a coin flip. Marking it `import type` is the fix in that case.
 */

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(ROOT, 'api/ai.ts');

interface Offender {
  file: string;
  specifier: string;
  line: number;
  text: string;
}

/** Resolve a relative specifier to a real source file, tolerating a .js suffix. */
function resolveSource(specifier: string, fromFile: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const visited = new Set<string>();
const offenders: Offender[] = [];

function walk(file: string): void {
  if (visited.has(file)) return;
  visited.add(file);

  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
  );

  for (const statement of source.statements) {
    const isImport = ts.isImportDeclaration(statement);
    const isExport = ts.isExportDeclaration(statement);
    if (!isImport && !isExport) continue;

    const moduleSpecifier = isImport ? statement.moduleSpecifier : statement.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) continue;

    const specifier = moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;   // bare package specifiers are Node's problem, not ours

    // Fully type-only statements are erased before Node ever loads the file.
    const typeOnly = isImport
      ? !!statement.importClause?.isTypeOnly
      : statement.isTypeOnly;

    const target = resolveSource(specifier, file);

    if (!typeOnly && !specifier.endsWith('.js')) {
      const { line } = source.getLineAndCharacterOfPosition(statement.getStart(source));
      offenders.push({
        file: path.relative(ROOT, file),
        specifier,
        line: line + 1,
        text: statement.getText(source).replace(/\s+/g, ' ').slice(0, 96),
      });
    }

    if (target) walk(target);
  }
}

walk(ENTRY);

console.log('─'.repeat(72));
console.log('Lambda ESM import check — files reachable from api/ai.ts:', visited.size);
console.log('─'.repeat(72));

if (offenders.length === 0) {
  console.log(`\n[PASS] every relative import is type-only or carries a .js extension\n`);
  process.exit(0);
}

for (const o of offenders) {
  console.log(`\n[FAIL] ${o.file}:${o.line}`);
  console.log(`       ${o.text}`);
  console.log(`       '${o.specifier}' would throw ERR_MODULE_NOT_FOUND in the lambda.`);
  console.log(`       Fix: '${o.specifier}.js', or mark the import 'import type' if it is types only.`);
}

console.log(`\n${offenders.length} import(s) would crash /api/ai at module load.\n`);
process.exit(1);
