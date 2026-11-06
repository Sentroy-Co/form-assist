'use client';
import { useEffect, useRef, useState } from 'react';
import { createAssistant } from '@sentroy-co/form-assist/browser';
import { useControlledFormBinding } from '@sentroy-co/form-assist/react';
import { registerFormAssist, type FormAssistButton } from '@sentroy-co/form-assist/ui';
import type { FormSnapshot } from '@sentroy-co/form-assist/core';

function initial(id: string): FormSnapshot {
  return { formId: id, schemaVersion: '1', revision: 'initial', schema: { type: 'object', properties: { title: { type: 'string', maxLength: 100 } }, required: ['title'], additionalProperties: false }, values: { title: '' }, fields: [{ path: '/title', aiWritable: true, description: 'Article title' }] };
}
export function DemoForm({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState(() => initial(id));
  const binding = useControlledFormBinding(snapshot, setSnapshot);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    registerFormAssist();
    const controller = createAssistant({ binding, connectionId: 'fixture', model: 'fixture', transport: async request => ({ protocolVersion: '1', requestId: request.requestId, formId: request.formId, baseRevision: request.baseRevision, changes: [{ op: 'replace', path: '/title', value: 'A thoughtful article title', reason: 'Local demo suggestion' }], questions: [], warnings: [] }) });
    const button = document.createElement('form-assist-button') as FormAssistButton;
    button.controller = controller;
    container.current?.append(button);
    return () => { button.close(); button.remove(); controller.dispose(); };
  }, [binding]);
  return <section aria-label={`${id} form`}><h2>{id} form</h2><label>Title <input aria-label={`${id} title`} value={String(snapshot.values.title)} onChange={event => { const value = event.target.value; setSnapshot(previous => ({ ...previous, revision: `${previous.revision}:edit`, values: { ...previous.values, title: value } })); }} /></label><div ref={container} /></section>;
}
