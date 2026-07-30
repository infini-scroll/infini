---
title: Headless interface
description: Use Infini with custom DOM rendering or a framework other than React.
---

# Headless interface

Headless means your application controls how each item becomes part of UI.

Use `@infini-scroll/core` with `@infini-scroll/dom-support` in browser environment.

## Install and initialize

::: code-group

```sh [npm]
npm install --save @infini-scroll/core @infini-scroll/dom-support
```

```sh [pnpm]
pnpm add --save @infini-scroll/core @infini-scroll/dom-support
```

```sh [yarn]
yarn add --save @infini-scroll/core @infini-scroll/dom-support
```

:::

```ts
import { InfiniController, initializeInfini } from "@infini-scroll/core";
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

const controller = new InfiniController<LogEntry, string, string>({
    provider: logProvider,
    ops: {
        getId: (entry) => entry.id,
        getCursor: (entry) => entry.cursor,
    },
    estimateSize: (entry) => (entry.message.length > 160 ? 88 : 48),
    defaultItemEstimate: 52,
    initial: { cursor: null },
    residentBefore: 50,
    residentAfter: 100,
});
```

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
