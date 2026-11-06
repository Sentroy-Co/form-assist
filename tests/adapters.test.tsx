// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { expect, it } from 'vitest';
import { createNativeBinding } from '../packages/form-assist/src/adapters/native.js';
import { useControlledFormBinding } from '../packages/form-assist/src/adapters/react.js';
import { createReactHookFormBinding } from '../packages/form-assist/src/adapters/react-hook-form.js';
import type { FormBinding } from '../packages/form-assist/src/browser/index.js';
import type { FormSnapshot } from '../packages/form-assist/src/core/types.js';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const initial = (): FormSnapshot => ({ formId: 'f', schemaVersion: '1', revision: '1', schema: { type: 'object' }, values: { title: 'old' }, fields: [{ path: '/title', aiWritable: true }] });
it('native binding reads only the chosen form and ignores sensitive controls', () => {
  document.body.innerHTML = '<form id="one"><input name="/title" value="first"><input type="password" name="/secret" value="private"></form><form><input name="/title" value="other"></form>';
  const form = document.querySelector('form')!; const binding = createNativeBinding(form, initial());
  const before = binding.read(); expect(before.values).toEqual({ title: 'first' });
  const next = structuredClone(before); next.values.title = 'updated'; next.revision = '2'; binding.write(next, ['/title'], before);
  expect((form.elements.namedItem('/title') as HTMLInputElement).value).toBe('updated'); expect((document.querySelectorAll('form')[1]!.elements.namedItem('/title') as HTMLInputElement).value).toBe('other');
});
it('updates actual controlled React state', async () => {
  let binding!: FormBinding;
  function App() { const [snapshot, setSnapshot] = useState(initial); binding = useControlledFormBinding(snapshot, setSnapshot); return <input value={String(snapshot.values.title)} readOnly />; }
  const host = document.createElement('div'); const root = createRoot(host); await act(async () => root.render(<App />));
  const before = binding.read(); const next = structuredClone(before); next.values.title = 'changed'; next.revision = '2';
  await act(async () => { await binding.write(next, ['/title'], before); }); expect(host.querySelector('input')!.value).toBe('changed');
  await act(async () => root.unmount());
});
it('updates actual React Hook Form state and runs validation', async () => {
  let binding!: FormBinding; let validations = 0;
  function App() { const methods = useForm<{title:string}>({ defaultValues: { title: 'old' } }); methods.register('title', { validate: () => { validations++; return true; } }); binding ??= createReactHookFormBinding(methods, initial()); return <span>{methods.watch('title')}</span>; }
  const host = document.createElement('div'); const root = createRoot(host); await act(async () => root.render(<App />));
  const before = binding.read(); const next = structuredClone(before); next.values.title = 'changed'; next.revision = '2';
  await act(async () => { await binding.write(next, ['/title'], before); }); expect(host.textContent).toBe('changed'); expect(validations).toBeGreaterThan(0);
  await act(async () => root.unmount());
});
