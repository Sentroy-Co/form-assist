import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FormBinding } from '../browser/index.js';
import type { FormSnapshot } from '../core/types.js';
import { assertExpected, copy } from './shared.js';

/** Bind controlled state; pass the current complete snapshot on every render. */
export function useControlledFormBinding(snapshot: FormSnapshot, setSnapshot: Dispatch<SetStateAction<FormSnapshot>>): FormBinding {
  const ref = useRef({ snapshot: copy(snapshot), listeners: new Set<() => void>() });
  ref.current.snapshot = copy(snapshot);
  const binding = useRef<FormBinding | null>(null);
  if (!binding.current) binding.current = {
    read: () => copy(ref.current.snapshot),
    write(next, _paths, expected) {
      assertExpected(ref.current.snapshot, expected);
      ref.current.snapshot = copy(next);
      setSnapshot(previous => { assertExpected(previous, expected); return copy(next); });
      for (const listener of ref.current.listeners) listener();
    },
    subscribe(listener) { ref.current.listeners.add(listener); return () => ref.current.listeners.delete(listener); },
  };
  useEffect(() => { for (const listener of ref.current.listeners) listener(); }, [snapshot]);
  return binding.current;
}
