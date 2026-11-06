import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { it, expect } from 'vitest';
it('shared versioned fixtures conform to the published request and plan schemas', () => {
  const ajv = new Ajv2020({ strict: false });
  for (const name of ['request', 'plan']) {
    const schema = JSON.parse(readFileSync(new URL(`../fixtures/${name}.schema.json`, import.meta.url), 'utf8'));
    const fixture = JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(fixture)).toBe(true);
    expect(validate({ ...fixture, protocolVersion: '2' })).toBe(false);
  }
});
