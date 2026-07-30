---
title: Errors and troubleshooting
description: Handle failures and diagnose common Infini integration problems.
---

# Errors and troubleshooting

Provider and contract errors are surfaced as ordinary `Error` objects. A
foreground failure appears in `snapshot.phase`; detached background work is
reported through `onError`.

## Foreground failure UI

Keep already committed content mounted:

```tsx
{snapshot.phase.status === "failed" && (
  <div role="alert">
    <span>{snapshot.phase.error.message}</span>
    <button onClick={controller.retry}>Retry</button>
  </div>
)}

<InfiniList controller={controller} renderItem={renderItem} />
```

`retry()` repeats the latched operation with its original target and alignment.
Outside the failed phase, it is a no-op.

## Background errors

```ts
onError(error, context) {
  telemetry.capture(error, {
    operation: context.operation,
    direction: context.direction,
    foreground: context.foreground,
  });
}
```

A detached result may no longer control what the user sees. Treat
`foreground: false` as telemetry or a subtle edge warning rather than a global
error screen.

## Common symptoms

### The first page fails even though the request succeeded

An open bootstrap must cover the Visible window after measurement. Return a
larger page based on `targetSize`, or truthfully mark the reached content
boundary exhausted.

### Requests repeat at an edge

Check that:

- an empty page exhausts the requested side;
- the returned edge cursor advances or an inclusive boundary ID overlaps;
- items are in canonical order;
- the response is contiguous.

### Rows jump when content above changes

Use `InfiniList` or `InfiniDomHost` so measurement and correction are executed
as a pair. In custom adapters, capture an anchor before geometry changes and
acknowledge the applied correction. Also verify that the physical scroll host
passed to the adapter is the element that actually owns scrolling.

### A fixed toolbar hides aligned items

Pass its covered pixels as `paddingStart` or `paddingEnd`. Do not include
ordinary in-flow headers.

### A distant scrollbar drag fails

The Provider needs `locateOffset` for predictive remote travel. If the product
does not support that capability, avoid presenting a large draggable predictive
runway as precise navigation and provide explicit application targets instead.

### State resets unexpectedly in React rows

Use immutable stable IDs. Do not derive identity from array indexes. Keep one
controller per mounted feed and do not remount the owner accidentally. The
React adapter preserves portal state while moving stable row shells.

### The overflow element does not scroll correctly

Pass the actual overflow element, not its parent. Create the list only after the
ref is non-null. The Infini surface must be inside that scroll host.

### Wasm fails to load

Confirm that:

- `initializeInfini()` runs before controller construction;
- the `.wasm` asset is emitted by the bundler;
- the asset URL is reachable under the deployed base path;
- the server serves `.wasm` as `application/wasm` for streaming
  instantiation (other MIME types can fall back but may be slower).

Pass an explicit URL to `initializeInfini(url)` when the default relative asset
location does not fit the deployment.

## When to recreate the controller

Retry and reopen preserve one identity domain. Recreate the controller when:

- the signed-in account or dataset changes;
- cursor semantics change;
- stable-ID meaning changes;
- the application intentionally wants to discard known data and tombstones.

A controller is not a global cache. Its lifetime should match one logical
ordered surface.
