import type { FormBinding } from '../browser/index.js';
import type { FormSnapshot, JsonValue } from '../core/types.js';
import { assertExpected, copy, get, set } from './shared.js';

/** Names are JSON pointers by default; pass a map when HTML names differ. */
export function createNativeBinding(form: HTMLFormElement, template: FormSnapshot, names: Record<string, string> = {}): FormBinding {
  let previous = copy(template); let counter = 0;
  const listeners = new Set<() => void>();
  const allowed = template.fields.filter(f => !f.hidden && !f.sensitive && !f.readOnly && f.aiWritable && !['hidden', 'password', 'file'].includes((f.inputType ?? '').toLowerCase()));
  const controls = (path: string) => Array.from(form.elements).filter((el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
    if (!('name' in el) || !('type' in el) || !('value' in el)) return false;
    const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    return input.name === (names[path] ?? path) && !['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image'].includes(input.type.toLowerCase());
  });
  function read(): FormSnapshot {
    const next = copy(previous);
    for (const field of allowed) {
      const elements = controls(field.path); if (!elements.length) continue;
      const first = elements[0]!; let value: JsonValue;
      if (first.type === 'radio') { const selected = elements.find(el => (el as HTMLInputElement).checked); if (!selected) continue; value = selected.value; }
      else if (first.type === 'checkbox') { value = elements.length > 1 ? elements.filter(el => (el as HTMLInputElement).checked).map(el => el.value) : (first as HTMLInputElement).checked; }
      else if (first instanceof form.ownerDocument.defaultView!.HTMLSelectElement && first.multiple) value = Array.from(first.selectedOptions).map(o => o.value);
      else if (first.type === 'number' || first.type === 'range') { if (first.value === '') value = ''; else value = Number(first.value); }
      else value = first.value;
      set(next.values, field.path, value);
    }
    if (JSON.stringify(next.values) !== JSON.stringify(previous.values)) next.revision = `${template.revision}:native:${++counter}`;
    previous = copy(next); return next;
  }
  const onChange = () => { read(); for (const listener of listeners) listener(); };
  return {
    read,
    write(next, paths, expected) {
      assertExpected(read(), expected);
      for (const path of paths) {
        if (!allowed.some(f => f.path === path)) throw new Error('Field is not bound.');
        if (!controls(path).length) throw new Error('Field control is missing.');
      }
      for (const path of paths) {
        const value = get(next.values, path); const elements = controls(path); const first = elements[0]!;
        if (first.type === 'radio') elements.forEach(el => { (el as HTMLInputElement).checked = el.value === value; });
        else if (first.type === 'checkbox') elements.forEach(el => { (el as HTMLInputElement).checked = Array.isArray(value) ? value.includes(el.value) : Boolean(value); });
        else if (first instanceof form.ownerDocument.defaultView!.HTMLSelectElement && first.multiple) Array.from(first.options).forEach(o => { o.selected = Array.isArray(value) && value.includes(o.value); });
        else first.value = value == null ? '' : String(value);
      }
      previous = copy(next);
      for (const listener of listeners) listener();
    },
    subscribe(listener) { if (!listeners.size) { form.addEventListener('input', onChange); form.addEventListener('change', onChange); } listeners.add(listener); return () => { listeners.delete(listener); if (!listeners.size) { form.removeEventListener('input', onChange); form.removeEventListener('change', onChange); } }; },
  };
}
