---
title: Controller
description: InfiniController methods and ownership reference.
---

# Controller

`InfiniController` owns ordered data, asynchronous Provider work, and
observable scrolling state. React users receive it from `useInfini`. Headless
users construct it directly.

## Lifecycle and observation

| Method | Purpose |
| --- | --- |
| `start()` | Idempotently starts the initial bootstrap |
| `subscribe(listener)` | Registers a change listener and returns `unsubscribe` |
| `getSnapshot()` | Returns the current immutable Snapshot |
| `setDebug(label)` | Updates the optional diagnostic label |
| `dispose()` | Permanently releases work and state; idempotent |

Call `start()` after a physical host has attached. Do not call methods other
than `dispose()` after disposal.

## Navigation and visibility

### `jump(target, options?)`

Starts a discontinuous bootstrap around an application target.

```ts
controller.jump(target, {
  direction: "after",
  alignment: "center",
});
```

Requires `targetToCursor`. Returns a numeric effect ticket for diagnostics.

### `getVisibleItem(ratio?)`

Returns the Layout item covering a waterline within Visible, or `null`.
`ratio` is clamped to `0…1` and defaults to `0`.

Use it to persist semantic reading position. It does not alter scroll
compensation.

### `retry()`

Retries a latched foreground failure with its original intent. No-op when the
phase is not `failed`.

## External data changes

| Method | Purpose |
| --- | --- |
| `insertExternal({ anchor, side, items })` | Insert ordered items next to a stable anchor |
| `deleteExternal(ids)` | Delete known IDs and prevent late revival |
| `updateExternal(items)` | Replace item objects without reordering |
| `reopen(direction)` | Mark a previously exhausted side open |
| `trimBuffer(direction, maxItems)` | Evict excess non-Resident edge items |

See [Navigation & live updates](/guide/navigation-and-updates) for examples.

## Physical-adapter methods

Applications using `InfiniList` or `InfiniDomHost` should not call these
directly.

| Method | Adapter responsibility |
| --- | --- |
| `setView(input)` | Report surface-local scroll, viewport, insets, and overscan |
| `setCandidatePreparer(fn)` | Install hidden candidate measurement |
| `commitCandidate(effectId, measurements)` | Atomically activate a measured candidate |
| `measure(measurements)` | Submit finite positive row extents |
| `commitLayout(revision, handles)` | Acknowledge the exact mounted set |
| `captureAnchor(ratio)` | Capture a semantic anchor before geometry changes |
| `takeScrollCorrection()` | Consume the pending absolute local-scroll target |
| `acknowledgeScrollCorrection(input)` | Report observed geometry after applying correction |
| `pin(id, pinned)` | Retain a focus-bearing row |

### Layout transaction rule

`commitLayout` must use the `layoutRevision` and exact handles from the
snapshot that was reconciled. It returns `false` for a stale revision or an
invalid handle set; the adapter should read the latest snapshot and reconcile
again.

### Correction acknowledgement rule

After consuming `takeScrollCorrection()`, the adapter must:

1. apply that absolute surface-local target to the physical scroll host;
2. measure the resulting actual host geometry;
3. call `acknowledgeScrollCorrection`.

Calling ordinary `setView` instead reports new user scroll intent and may
incorrectly trigger remote prediction.

## Method binding

`subscribe`, `getSnapshot`, and `retry` are safe to pass directly as callbacks:

```ts
const unsubscribe = controller.subscribe(render);
button.addEventListener("click", controller.retry);
```

For other methods, use a closure unless your code already preserves the
receiver.
