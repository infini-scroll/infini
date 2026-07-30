---
title: Configuration
description: InfiniController configuration reference.
---

# Configuration

`ControllerConfig<TItem, TCursor, TId, TTarget>` is read when a controller is
created. Treat it as immutable for that controller's lifetime.

## Required fields

### `provider`

```ts
provider: Provider<TItem, TCursor, TId>;
```

Ordered data source. See the [Provider contract](/guide/provider).

### `ops`

```ts
ops: {
  getId(item: TItem): TId;
  getCursor(item: TItem): TCursor;
}
```

Projects stable identity and the Provider cursor from each item. `TId` must be
`string | number`.

### `estimateSize`

```ts
estimateSize(item: TItem): number
```

Returns an initial positive block-size estimate in CSS pixels. It does not need
to be exact. Use information already present on the item; do not trigger DOM
reads or asynchronous work.

### `defaultItemEstimate`

```ts
defaultItemEstimate: number;
```

Positive fallback extent, also used for remote distance prediction. Prefer a
representative median row height. An invalid value throws during construction.

### `initial`

```ts
initial: {
  cursor: TCursor | null;
  target?: TTarget;
  alignment?: "start" | "center" | "end" | "nearest";
}
```

The initial bootstrap position. `cursor: null` asks the Provider for its
default. When `target` is present, configure `targetToCursor`; configure
`locateTarget` for exact row alignment.

## Navigation fields

### `targetToCursor`

```ts
targetToCursor?: (target: TTarget) => TCursor
```

Converts an application target into a bootstrap cursor. Required by `jump()`.

### `locateTarget`

```ts
locateTarget?: (
  items: readonly TItem[],
  target: TTarget,
) => TId | null
```

Selects the exact stable ID from a bootstrap page. Return `null` when the page
does not contain an exact target.

## Window and retention fields

### `layoutBefore`, `layoutAfter`

```ts
layoutBefore?: number
layoutAfter?: number
```

Pixel overscan outside Visible. When omitted, each side follows the current
viewport extent. The DOM host may override these values.

Increase them when high scroll velocity exposes staging latency. Decrease them
when rows are exceptionally expensive. Measure the result; more overscan is not
automatically better.

### `residentBefore`, `residentAfter`

```ts
residentBefore?: number // default 0
residentAfter?: number  // default 0
```

Additional item counts retained around Layout when computing Resident. These
values influence data readiness and `residentRange`, not DOM pixel overscan.

### `staleMissLimit`

```ts
staleMissLimit?: number // default 3
```

Number of relevant successful loads without a shared stable ID before an old
detached Island is discarded. Most applications should keep the default.

## Diagnostics

### `debug`

```ts
debug?: string
```

Optional label attached to adapter diagnostics. Use a short component or feed
name and normally enable it only in development.

### `onError`

```ts
onError?: (
  error: Error,
  context: {
    operation: "bootstrap" | "fetch" | "seek";
    direction: "before" | "after";
    foreground: boolean;
  },
) => void
```

Receives background and foreground Provider failures. UI should still use
`snapshot.phase` for the current foreground error state.

## Example

```ts
const config = {
    debug: import.meta.env.DEV ? "Conversation" : undefined,
    provider,
    ops: {
        getId: (item) => item.id,
        getCursor: (item) => item.cursor,
    },
    estimateSize: (item) => item.previewLines * 20 + 24,
    defaultItemEstimate: 72,
    initial: {
        cursor: null,
        target: route.messageId,
        alignment: "center",
    },
    targetToCursor: (id) => id,
    locateTarget: (items, id) =>
        items.some((item) => item.id === id) ? id : null,
    layoutBefore: 900,
    layoutAfter: 1200,
    residentBefore: 30,
    residentAfter: 50,
    onError: reportInfiniError,
} satisfies ControllerConfig<Message, string, string, string>;
```
