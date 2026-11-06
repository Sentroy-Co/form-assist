import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'packages/form-assist');
for (const name of ['docs', 'fixtures']) await cp(resolve(root, name), resolve(target, name), { recursive: true });
for (const name of ['README.md', 'LICENSE', 'COMPATIBILITY.md']) await writeFile(resolve(target, name), await readFile(resolve(root, name)));
