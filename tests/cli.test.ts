import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const cli = 'packages/form-assist/dist/cli/index.js';
const request = readFileSync('fixtures/cli/request.json', 'utf8');
const expected = JSON.parse(readFileSync('fixtures/cli/response.json', 'utf8'));
function run(extra: string[]) { return spawnSync(process.execPath, [cli, 'propose', '--fixture', 'demo', '--connection', 'demo', '--model', 'demo', '--stdin', ...extra], { input: request, encoding: 'utf8' }); }
describe('CLI protocol', () => {
 it('returns the shared validated fixture', () => { const r = run(['--json']); expect(r.status).toBe(0); expect(JSON.parse(r.stdout)).toEqual(expected); });
 it('emits complete versioned stream events', () => { const r = run(['--stream']); expect(r.status).toBe(0); const events = r.stdout.trim().split('\n').map(line => JSON.parse(line)); expect(events.map(e => e.type)).toEqual(['start', 'result']); expect(events[1].plan).toEqual(expected); });
 it('rejects a model outside the allowlist', () => { const r = spawnSync(process.execPath, [cli, 'propose', '--fixture', 'demo', '--connection', 'demo', '--model', 'other', '--stdin', '--json'], { input: request.replace('"model":"demo"', '"model":"other"'), encoding: 'utf8' }); expect(r.status).toBe(4); expect(JSON.parse(r.stdout).error.code).toBe('FORBIDDEN'); });
});
