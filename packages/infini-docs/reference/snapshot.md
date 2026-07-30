---
title: Snapshot
description: Observable Infini state reference.
---

# Snapshot

A Snapshot is an immutable, revision-scoped view of controller state. The same
object is returned until `revision` changes. Do not mutate its arrays or retain
pixel positions across revisions.

## Lifecycle

### `revision`

Monotonically increasing observable-state revision.

### `phase`

```ts
type Phase =
    | { status: "dormant" }
    | { status: "bootstrapping" }
    | { status: "ready"; empty: boolean }
    | { status: "seeking" }
    | {
          status: "failed";
          operation: "bootstrap" | "fetch" | "seek";
          direction?: "before" | "after";
          error: Error;
      };
```

Phase describes the foreground experience, not all live requests.

### `effects`

Diagnostic summaries of current `bootstrap`, `fetch`, or `seek` work. Most UI
should prefer phase and directional loading fields.

## Geometry and layout

| Field            | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `layoutRevision` | Transaction version to acknowledge after reconciliation      |
| `layoutItems`    | Rows that the physical adapter must currently reconcile      |
| `candidate`      | Hidden page awaiting measurement and activation              |
| `surfaceExtent`  | Full physical scroll-surface height                          |
| `islandOrigin`   | Physical surface position where Main begins                  |
| `visible`        | Unobscured viewport in Main-local coordinates                |
| `layoutTarget`   | Pixel range requested for mount and measurement              |
| `blankZone`      | `"before"`, `"after"`, or `"none"` for the current waterline |

Each Layout item contains:

```ts
{
    handle: number;
    id: TId;
    item: TItem;
    index: number;
    start: number;
    extent: number;
    measured: boolean;
}
```

`start`, `extent`, and `index` are current-layout facts. Persist `id`, not these
values.

## Retention and known content

| Field                         | Meaning                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `residentCount`               | Items in the dynamically computed Resident range                  |
| `residentRange`               | Inclusive first/last stable ID, suitable for nearby subscriptions |
| `bufferBefore`, `bufferAfter` | Known items outside Resident on each side                         |
| `mainItems`                   | All known Main items, including Resident and Buffer               |
| `mainLength`                  | Number of known Main items                                        |
| `mainExtent`                  | Estimated/measured total Main height                              |

`mainItems` is useful for diagnostics and application progress, but rendering
should follow `layoutItems`.

## Boundaries and loading

```ts
snapshot.exhaustedBefore;
snapshot.exhaustedAfter;
snapshot.loadingBefore;
snapshot.loadingAfter;
```

Exhausted means the Provider has proven a real content boundary. Loading fields
describe current edge extension and are independent.

## Island diagnostics

```ts
snapshot.mainIsland;
snapshot.staleBeforeIsland;
snapshot.staleAfterIsland;
```

These numeric identities help diagnose distant jumps and reuse. A value of `0`
means no such Island. Application logic should not derive content order from
them.

## Identity lookups

```ts
snapshot.getItem(handle);
snapshot.getHandle(id);
```

These bridge the controller's numeric handles and Provider-owned business
identity. Results are live only while that identity remains registered.

## Subscription example

```ts
let snapshot = controller.getSnapshot();

const unsubscribe = controller.subscribe(() => {
    const next = controller.getSnapshot();
    if (next === snapshot) return;
    snapshot = next;

    renderStatus(next.phase);
    updateNearbySubscription(next.residentRange);
});
```
