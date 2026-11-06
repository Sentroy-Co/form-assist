import { expect, it } from 'vitest';
it('imports browser adapters without a DOM', async () => {
  expect(typeof globalThis.document).toBe('undefined');
  const [native, react, rhf, browser] = await Promise.all([
    import('../packages/form-assist/src/adapters/native.js'),
    import('../packages/form-assist/src/adapters/react.js'),
    import('../packages/form-assist/src/adapters/react-hook-form.js'),
    import('../packages/form-assist/src/browser/index.js'),
  ]);
  expect(native.createNativeBinding).toBeTypeOf('function'); expect(react.useControlledFormBinding).toBeTypeOf('function'); expect(rhf.createReactHookFormBinding).toBeTypeOf('function'); expect(browser.createAssistant).toBeTypeOf('function');
});
