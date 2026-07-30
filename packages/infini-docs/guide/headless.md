---
title: Headless interface
description: Use Infini with custom DOM rendering or a framework other than React.
---

# Headless interface

“Headless” means your application controls how each business item becomes UI.
Infini still owns the difficult scrolling mechanics.

For browser integrations, the recommended headless stack is:

```text
your framework or view code
        ↓ row hooks
InfiniDomHost
        ↓ layout + measurement
InfiniController
        ↓ page requests
your Provider
```

Use `@infini-scroll/core` with `@infini-scroll/dom-support`. Only implement the
controller's low-level measurement protocol yourself when targeting a
non-DOM platform or authoring another physical adapter.

## Install and initialize

```sh
pnpm add @infini-scroll/core @infini-scroll/dom-support
```

```ts
import {
  InfiniController,
  initializeInfini,
} from "@infini-scroll/core";
import { InfiniDomHost } from "@infini-scroll/dom-support";

await initializeInfini();
```

## Create the controller

```ts
type LogEntry = {
  id: string;
  cursor: string;
  level: "info" | "warn" | "error";
  message: string;
};

const controller = new InfiniController<
  LogEntry,
  string,
  string
>({
  provider: logProvider,
  ops: {
    getId: (entry) => entry.id,
    getCursor: (entry) => entry.cursor,
  },
  estimateSize: (entry) => entry.message.length > 160 ? 88 : 48,
  defaultItemEstimate: 52,
  initial: { cursor: null },
  residentBefore: 50,
  residentAfter: 100,
});
```

Construction does not start network work. This gives the physical host time to
attach first.

## Attach a DOM host

Your document needs a surface inside either the window or an overflow element:

```html
<div id="viewport">
  <div id="log-surface"></div>
</div>
```

```css
#viewport {
  height: 70vh;
  overflow: auto;
}

.log-row {
  width: 100%;
  padding: 8px 12px;
  box-sizing: border-box;
}
```

Create the host with row lifecycle hooks:

```ts
const viewport = document.querySelector<HTMLElement>("#viewport")!;
const surface = document.querySelector<HTMLElement>("#log-surface")!;

const host = new InfiniDomHost({
  controller,
  container: surface,
  scrollHost: viewport,

  createRow(entry, id) {
    const row = document.createElement("article");
    row.className = `log-row log-row--${entry.level}`;
    row.dataset.id = id;
    row.textContent = entry.message;
    return row;
  },

  updateRow(row, entry) {
    row.className = `log-row log-row--${entry.level}`;
    row.textContent = entry.message;
  },

  disposeRow(row) {
    // Unmount framework roots, detach subscriptions, or release resources.
  },
});

controller.start();
```

The element returned from `createRow` must be the final stable row root. The
host may first place it in a hidden measurement region and later move the same
node into the live track.

## Connect another UI framework

Mount one independent framework root per stable row shell:

```ts
const roots = new WeakMap<HTMLElement, FrameworkRoot>();

const host = new InfiniDomHost({
  controller,
  container: surface,
  scrollHost: viewport,

  createRow(item) {
    const node = document.createElement("div");
    const root = framework.createRoot(node);
    roots.set(node, root);
    root.render(ItemView, { item });
    return node;
  },

  updateRow(node, item) {
    roots.get(node)?.render(ItemView, { item });
  },

  disposeRow(node) {
    roots.get(node)?.unmount();
    roots.delete(node);
  },
});
```

Keep framework state keyed to the row's stable ID. Never key it to the row's
temporary rank or pixel position.

## Observe state

The controller follows the external-store pattern:

```ts
let previousRevision = -1;

const unsubscribe = controller.subscribe(() => {
  const snapshot = controller.getSnapshot();
  if (snapshot.revision === previousRevision) return;
  previousRevision = snapshot.revision;

  status.textContent = snapshot.phase.status;
  beforeSpinner.hidden = !snapshot.loadingBefore;
  afterSpinner.hidden = !snapshot.loadingAfter;
});
```

Call `getSnapshot()` inside the listener rather than assuming the callback
carries state. A snapshot object remains referentially stable until its
`revision` changes.

## Host methods

### `scrollToItem(id, alignment?)`

Physically aligns a row already in Layout. It returns `false` if a data jump is
needed:

```ts
if (!host.scrollToItem(targetId, "center")) {
  controller.jump(targetId, { alignment: "center" });
}
```

### `setViewportOptions(options)`

Updates fixed-overlay insets, Layout overscan, or the anchor waterline without
recreating the host.

### `flushNow()`

Synchronously processes work that has already been observed. It is useful for
deterministic tests. Normal applications should let the host batch work into
animation frames.

### `dispose()`

Removes DOM listeners and observers and disposes all row shells. It does not
dispose the controller because the two objects have separate ownership.

## Cleanup

Release in the opposite order:

```ts
unsubscribe();
host.dispose();
controller.dispose();
```

Both host and controller disposal are idempotent. Do not use either object
after it has been disposed.

## Advanced: implementing a physical adapter

`InfiniDomHost` is not required. A new physical adapter can subscribe directly
to `Snapshot` and execute the protocol:

1. report scroll geometry with `setView`;
2. hidden-mount and measure `candidate`;
3. activate it with `commitCandidate`;
4. reconcile `layoutItems`;
5. submit row extents with `measure`;
6. acknowledge the exact mounted handles with `commitLayout`;
7. apply `takeScrollCorrection`, then report observed geometry through
   `acknowledgeScrollCorrection`;
8. use `captureAnchor` before adapter-driven geometry changes;
9. pin focus-bearing rows with `pin`.

These calls form a transaction protocol, not a bag of optional rendering
helpers. A DOM integration should use `InfiniDomHost` unless it genuinely needs
different physical behavior.
