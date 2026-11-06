import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import type { FormBinding } from '../browser/index.js';
import type { FormSnapshot } from '../core/types.js';
import { assertExpected, copy, get, segments } from './shared.js';

/** Use a dedicated methods instance for each form. Validation uses RHF's trigger. */
export function createReactHookFormBinding<T extends FieldValues>(methods: UseFormReturn<T>, template: FormSnapshot): FormBinding {
  let previous = copy(template), count = 0, writing = false;
  const listeners = new Set<() => void>();
  function read(): FormSnapshot {
    const next = copy(previous); next.values = copy(methods.getValues()) as FormSnapshot['values'];
    if (!writing && JSON.stringify(next.values) !== JSON.stringify(previous.values)) next.revision = `${template.revision}:rhf:${++count}`;
    previous = copy(next); return next;
  }
  return {
    read,
    async write(next, paths, expected) {
      assertExpected(read(), expected);
      writing = true;
      try {
        for (const path of paths) {
          const name = segments(path).join('.') as Path<T>;
          methods.setValue(name, get(next.values, path) as PathValue<T, Path<T>>, { shouldDirty: true, shouldTouch: true });
        }
        previous = copy(next);
      } finally { writing = false; }
      await methods.trigger(paths.map(p => segments(p).join('.') as Path<T>));
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener); const subscription = methods.watch(() => { if (!writing) { read(); for (const l of listeners) l(); } });
      return () => { listeners.delete(listener); subscription.unsubscribe(); };
    },
  };
}
