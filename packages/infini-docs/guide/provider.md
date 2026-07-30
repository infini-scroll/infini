---
title: Write your provider
description: The data-source interface required by Infini.
---

# Write your provider

The Provider is the bridge to your data source. It establishes a
contiguous Page near a Cursor, extends a known edge, and optionally translates
a predicted relative offset into another cursor.

```ts
interface Provider<TItem, TCursor, TId extends string | number> {
    // Fetch in both direction
    bootstrap(input: {
        cursor: TCursor | null;
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<TItem>>;

    // Fetch in one direction
    fetch(input: {
        cursor: TCursor;
        direction: "before" | "after";
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<TItem>>;

    // Only required if you want to use the Predictive Seek & controller.jump feature.
    // Computes newItem = anchorItem + signedItemOffset
    locateOffset?(input: {
        anchor: TItem;
        signedItemOffset: number;
        signal: AbortSignal;
    }): Promise<{ cursor: TCursor; targetId?: TId }>;
}
```

## IDs are stable

`ops.getId(item)` must return a string or number that:

- identifies one logical item for its entire lifetime;
- is never reused after that item is deleted;
- does not change when the item content changes.

## Pages

- Pages use canonical content order. Always return `items` from before to after, even for a `"before"` fetch.
- The order of items should never change. If an item moves to another position, remove the old item and
  inserting a new item with a new ID. If you are shifting to different views, recreate the controller instance.
- When nothing left to load, set exhausted properly to avoid spamming requests. If appending/prepending can happen, see Live Data.

## Cursors

`TCursor` can be a timestamp, database token, or compound object. Infini
only stores it and returns it to the Provider as is via `ops.getCursor`.
If deletion is rare or impossible, you can even use ID as cursor.

Both inclusive or exclusive edge semantics are supported. Dedupe is handled automatically as long as IDs are stable.

| stage                  | layout          |
| ---------------------- | --------------- |
| Known (`getCursor(D)`) | `A B C D`       |
| Response (inclusive)   | `D E F G`       |
| Merged                 | `A B C D E F G` |

## `targetSize` is measured in pixels

Infini asks for enough content to cover a visual target. The Provider will
rarely know exact heights without doing real layout, so use a reasonable average.

```ts
const approximateRows = Math.ceil(targetSize / 72) + 4;
```

Returning more or less is safe. If there's extra, they will be kept in Buffer. If there's less, Infini would help fetch more (though it would make bootstrap much slower).

## When to implement `locateOffset`

You can omit `locateOffset` if the product only needs adjacent scrolling and
explicit jumps to known application targets.

Implement it when users can enter the predictive blank runway—for example by
dragging the scrollbar thumb far away. Infini supplies:

- a known `anchor` item;
- a signed estimated number of items from that anchor;
- a cancellation signal.

The returned location may be approximate:

```ts
async locateOffset({ anchor, signedItemOffset, signal }) {
  const result = await api.locateRelative({
    id: anchor.id,
    offset: signedItemOffset,
    signal,
  });
  return {
    cursor: result.cursor,
    targetId: result.nearestMessageId,
  };
}
```

The following bootstrap and DOM measurement establish exact local geometry.
`locateOffset` is not called for normal edge fetching.

## Cancellation and stale responses

Use the supplied `AbortSignal` to save network and server work. Correctness must
not depend on cancellation succeeding: a request may settle after the user has
moved elsewhere. Infini identifies every request and decides whether a late
result can still extend, be retained, or be ignored.

Do not reuse one in-flight Promise as the response to a different logical
request.

## Live data

Push events are separate from Provider methods:

```ts
controller.insertExternal({
    anchor: event.anchorId,
    side: event.side,
    items: event.items,
});

controller.deleteExternal(event.ids);
controller.updateExternal(event.items);
controller.reopen("after");
```

Events for one ordered sequence must be ordered, not omitted, and eventually delivered. A response from provider should reflect data at least as fresh as the moment its request began. Infini replays newer local events over the last response.

If a previously exhausted side receives a new boundary item, call
`controller.reopen("after")` or `"before"` after applying the event.
