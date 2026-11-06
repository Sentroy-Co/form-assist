import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const packageMetadata = JSON.parse(await readFile(join(root, 'packages/form-assist/package.json'), 'utf8'));
const expectedArchive = `${packageMetadata.name.replace(/^@/, '').replaceAll('/', '-')}-${packageMetadata.version}.tgz`;
const archives = (await readdir(join(root, 'artifacts'))).filter(file => file === expectedArchive);
if (archives.length !== 1) throw new Error('Produce the current package tarball with npm run pack:local');
const temporary = await mkdtemp(join(tmpdir(), 'form-assist-consumer-'));
try {
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'clean-consumer', version: '1.0.0', private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(root, 'artifacts', archives[0])], { cwd: temporary, stdio: 'pipe' });
  const fixture = JSON.parse(await readFile(join(root, 'fixtures/article.json'), 'utf8'));
  const plan = JSON.parse(await readFile(join(root, 'fixtures/plan.json'), 'utf8'));
  await writeFile(join(temporary, 'verify.mjs'), `
    import assert from 'node:assert/strict';
    import { applyPlan, validateForm } from '@sentroy-co/form-assist';
    const form = ${JSON.stringify(fixture)};
    validateForm(form);
    assert.equal(applyPlan(form, ${JSON.stringify(plan)}).form.values.title, 'Organizing Your Source Notes');
    for (const path of ['core','browser','ui','i18n','native','server','server/node','providers']) await import('@sentroy-co/form-assist/'+path);
    const { supportedLocales, loadCatalog } = await import('@sentroy-co/form-assist/i18n');
    assert.equal(supportedLocales.length, 54);
    assert.equal((await loadCatalog('ja')).ui.close, '閉じる');
    assert.equal(typeof globalThis.window, 'undefined');
    console.log('Clean consumer: exports, apply and SSR-safe imports passed');
  `);
  execFileSync(process.execPath, ['verify.mjs'], { cwd: temporary, stdio: 'inherit' });
  const doctor = JSON.parse(execFileSync(join(temporary, 'node_modules/.bin/form-assist'), ['doctor', '--json'], { cwd: temporary, encoding: 'utf8' }));
  if (doctor.status !== 'ok') throw new Error('Installed CLI executable failed');
} finally { await rm(temporary, { recursive: true, force: true }); }

const measurements = { measuredAt: new Date().toISOString(), node: process.version, package: archives[0], bundles: {} };
await mkdir(join(root, 'artifacts', 'bundles'), { recursive: true });
for (const entry of ['core', 'browser', 'ui', 'i18n']) {
  const result = await build({ stdin: { contents: `export * from '@sentroy-co/form-assist/${entry}';`, resolveDir: root }, bundle: true, platform: 'browser', format: 'esm', minify: true, splitting: true, charset: 'utf8', outdir: join(root, 'artifacts/bundles', entry), write: false, metafile: true });
  const inputs = Object.keys(result.metafile.inputs);
  if (entry === 'core' && inputs.some(file => /\/(ui|browser|providers|server|adapters)\//.test(file))) throw new Error('Core crossed runtime boundaries');
  if (inputs.some(file => /\/server\//.test(file))) throw new Error('Browser bundle included server code');
  const outputs = new Map(Object.entries(result.metafile.outputs).map(([key, value]) => [resolve(root, key), value]));
  const files = new Map(result.outputFiles.map(file => [file.path, file.contents]));
  const entryFile = [...outputs].find(([, value]) => value.entryPoint === '<stdin>')?.[0];
  if (!entryFile) throw new Error('Missing bundle entry');
  const initial = new Set();
  function visit(path) {
    if (initial.has(path)) return;
    initial.add(path);
    for (const dependency of outputs.get(path)?.imports ?? []) {
      if (dependency.external || dependency.kind === 'dynamic-import') continue;
      const absolute = outputs.has(resolve(root, dependency.path)) ? resolve(root, dependency.path) : resolve(dirname(path), dependency.path);
      visit(absolute);
    }
  }
  visit(entryFile);
  for (const file of result.outputFiles) { await mkdir(dirname(file.path), { recursive: true }); await writeFile(file.path, file.contents); }
  const bytes = [...initial].reduce((sum, path) => sum + (files.get(path)?.byteLength ?? 0), 0);
  const compressed = [...initial].reduce((sum, path) => sum + gzipSync(files.get(path)).byteLength, 0);
  measurements.bundles[entry] = { minifiedBytes: bytes, gzipBytes: compressed, lazyChunks: result.outputFiles.length - initial.size, totalIncludingAllLocalesBytes: result.outputFiles.reduce((sum, file) => sum + file.contents.byteLength, 0) };
}
for (const entry of ['server', 'server/node', 'providers']) {
  let denied = false;
  try {
    await build({ stdin: { contents: `import '@sentroy-co/form-assist/${entry}';`, resolveDir: root }, bundle: true, platform: 'browser', write: false, logLevel: 'silent' });
  } catch { denied = true; }
  if (!denied) throw new Error(`Server import ${entry} was allowed in a browser build`);
}
const edge = await build({ stdin: { contents: `export * from '@sentroy-co/form-assist/server'; export * from '@sentroy-co/form-assist/providers';`, resolveDir: root }, bundle: true, platform: 'browser', conditions: ['workerd'], format: 'esm', write: false, logLevel: 'silent', metafile: true });
if (Object.keys(edge.metafile.inputs).some(file => file.includes('/server/node'))) throw new Error('Workers build imported Node storage');
const budgets = { core: 50_000, browser: 52_000, ui: 15_000, i18n: 8_000 };
for (const [entry, budget] of Object.entries(budgets)) {
  if (measurements.bundles[entry].gzipBytes > budget) throw new Error(`${entry} exceeds gzip budget ${budget}`);
}
await writeFile(join(root, 'docs', 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
console.log(JSON.stringify(measurements, null, 2));
