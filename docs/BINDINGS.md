# Form bindings

A binding is scoped to one form instance. `createAssistant({ binding, transport, connectionId, model })` reads the snapshot before requesting suggestions, validates the returned plan and checks it again before applying selected paths. It never submits the form. The host must explicitly call `apply` after review. `undo` refuses to overwrite later edits to affected fields.

The `FormBinding.write(next, changedPaths, expected)` contract requires a compare-and-write: check the complete current snapshot against `expected` immediately before committing and reject on mismatch. A custom asynchronous binding must implement this atomically in its state store; checking only before an `await` is insufficient. `read()` must reflect committed writes, and snapshots must include a revision that changes with user edits. A subscription informs the controller promptly, but reads are also checked before and after writes.

## Native forms

`createNativeBinding(formElement, snapshot, names?)` binds only controls in the explicitly supplied form, and only writable field policies. HTML names default to JSON pointers (for example `/title`); `names` maps pointers to other control names. Hidden, password, file, sensitive, read-only and non-writable fields are excluded. Text, number, boolean checkbox, checkbox groups, radio groups and multiple selects are supported. Map complex widgets and non-string option values with a custom binding. It never dispatches submit. Host code can subscribe through the controller; applications requiring custom input events should integrate via their own binding.

## Controlled React

`useControlledFormBinding(snapshot, setSnapshot)` binds React state containing the complete snapshot. Render controlled inputs from `snapshot.values` and update the snapshot through the same setter when users type, changing its revision. The binding uses a functional state update and checks the expected snapshot again when React processes it. Keep the hook and its controller scoped to a mounted form. React's asynchronous updates mean a competing queued state update can reject during React processing; applications that need graceful conflict presentation for concurrent updates should supply a synchronous compare-and-write external store binding.

## React Hook Form

`createReactHookFormBinding(methods, snapshot)` uses an individual `useForm()` methods object, calls `setValue` for selected fields and `trigger` to run RHF validation. JSON pointer segments become RHF dot paths, so names containing dots cannot be represented; use a custom binding for those. Keep the binding stable across renders and initialize RHF defaults to the snapshot values. RHF validation runs after changes and cannot provide transactional rollback for asynchronous custom validation; the JSON Schema validation is performed atomically before any setter call. Avoid programmatic writes during a binding update. No DOM values are assigned by the React adapters.

Imports of these modules do not access the DOM, allowing server-side module loading. Instantiate the native binding only in a browser with a chosen form.
