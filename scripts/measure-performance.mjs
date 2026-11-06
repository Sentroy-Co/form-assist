import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { validatePlan } from '../packages/form-assist/dist/core/index.js';
const root = resolve(import.meta.dirname, '..');
const form = JSON.parse(await readFile(resolve(root, 'fixtures/article.json'), 'utf8'));
const plan = JSON.parse(await readFile(resolve(root, 'fixtures/plan.json'), 'utf8'));
validatePlan(form, plan);
const timings = [];
for (let index = 0; index < 50; index++) {
  const start = performance.now(); validatePlan(form, plan); timings.push(performance.now() - start);
}
timings.sort((a, b) => a - b);
const result = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch, operation: 'validatePlan(article, one-change-plan)', samples: timings.length, medianMs: Number(timings[25].toFixed(3)), p95Ms: Number(timings[47].toFixed(3)), budgetP95Ms: 100 };
await writeFile(resolve(root, 'docs/performance.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.p95Ms > result.budgetP95Ms) throw new Error('Local validation p95 exceeds budget');
