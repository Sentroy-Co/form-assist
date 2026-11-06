import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { loadCatalog, supportedLocales } from '../packages/form-assist/src/i18n/index.js';
import { validatePlan, type FormSnapshot } from '../packages/form-assist/src/core/index.js';

it('all 54 localized demo proposals respect the actual registered form limits', async () => {
  const form = JSON.parse(readFileSync(new URL('../fixtures/article.json', import.meta.url), 'utf8')) as FormSnapshot;
  for (const { code } of supportedLocales) {
    const { demo } = await loadCatalog(code);
    expect(() => validatePlan(form, {
      protocolVersion: '1', requestId: `locale-${code}`, formId: form.formId, baseRevision: form.revision,
      changes: [
        { op: 'replace', path: '/title', value: demo.fixtureTitle, reason: demo.fixtureReason },
        { op: 'replace', path: '/excerpt', value: demo.fixtureExcerpt },
        { op: 'replace', path: '/body', value: demo.fixtureBody },
        { op: 'replace', path: '/seoTitle', value: demo.fixtureSeoTitle },
      ], questions: [], warnings: [demo.fixtureWarning],
    }), code).not.toThrow();
    expect(demo.fixtureBody.startsWith('# '), code).toBe(true);
    expect(demo.fixtureBody.includes('\n\n## '), code).toBe(true);
  }
});
