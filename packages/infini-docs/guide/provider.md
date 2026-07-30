---
title: Provider contract
description: The data-source interface required by Infini.
---

# Provider contract

The Provider is the only required bridge to your data source. It establishes a
contiguous page near a cursor, extends a known edge, and optionally translates
a predicted relative offset into another cursor.

```ts
interface Provider<TItem, TCursor, TId extends string | number> {
  bootstrap(input: {
    cursor: TCursor | null;
    targetSize: number;
    signal: AbortSignal;
  }): Promise<Page<TItem>>;

  fetch(input: {
    cursor: TCursor;
    direction: "before" | "after";
    targetSize: number;
    signal: AbortSignal;
  }): Promise<Page<TItem>>;

  locateOffset?(input: {
    anchor: TItem;
    signedItemOffset: number;
    signal: AbortSignal;
  }): Promise<{ cursor: TCursor; targetId?: TId }>;
}
```

Infini does not require a total count, global index, comparable cursors, or a
server revision.

## The four invariants

### 1. IDs are stable

`ops.getId(item)` must return a string or number that:

- identifies one logical item for its entire lifetime;
- is unique within a page and across live items;
- is never reused after that item is deleted;
- does not change when the item content changes.

If an item moves to another position, model it as deleting the old ID and
inserting a new item with a new ID.

### 2. Pages are contiguous

Between the first and last returned items, do not silently omit an item that
belongs to the same server view. Filters should therefore be part of the
Provider's sequence definition, not applied inconsistently per request.

### 3. Pages use canonical content order

Always return `items` from before to after, even for a `"before"` fetch. Do not
reverse the array to match request direction.

### 4. Boundary flags are truthful

`exhaustedBefore` means there is no content before the first returned item.
`exhaustedAfter` means there is no content after the last. `false` means only
“there may be more.”

An empty fetch must exhaust the requested side. An empty bootstrap is valid
only when both sides are exhausted.

## Cursors are yours

`TCursor` can be an ID, timestamp, database token, or compound object. Infini
only stores it and returns it to the Provider via `ops.getCursor`.

Choose and document inclusive or exclusive edge semantics. Inclusive pages are
usually easiest to make contiguous:

```text
known items:          A B C D
fetch after cursor D:       D E F G
merged result:        A B C D E F G
```

The repeated `D` is deduplicated by stable ID and acts as proof of overlap.
Exclusive pages can work, but the response must still be the true immediate
continuation.

## `targetSize` is measured in pixels

Infini asks for enough content to cover a visual target. The Provider will
rarely know exact unrendered heights, so use a reasonable average, cached
measurements, or server metadata:

```ts
const approximateRows = Math.ceil(targetSize / 72) + 4;
```

Returning more is safe; extra rows become Buffer. Returning a little less at a
real content boundary is also safe. An open bootstrap that remains shorter than
the visible viewport after measurement is rejected, because showing it would
expose a false gap.

## A practical REST Provider

Assume the server accepts `around`, `before`, and `after` cursors and always
returns canonical order:

```ts
type ApiPage = {
  messages: Message[];
  hasBefore: boolean;
  hasAfter: boolean;
};

async function requestPage(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<Page<Message>> {
  const response = await fetch(`/api/messages?${params}`, { signal });
  if (!response.ok) throw new Error(`Messages: ${response.status}`);
  const page: ApiPage = await response.json();

  return {
    items: page.messages,
    exhaustedBefore: !page.hasBefore,
    exhaustedAfter: !page.hasAfter,
  };
}

const provider: Provider<Message, string, string> = {
  bootstrap({ cursor, targetSize, signal }) {
    return requestPage(
      new URLSearchParams({
        around: cursor ?? "",
        pixels: String(targetSize),
      }),
      signal,
    );
  },

  fetch({ cursor, direction, targetSize, signal }) {
    return requestPage(
      new URLSearchParams({
        [direction]: cursor,
        pixels: String(targetSize),
      }),
      signal,
    );
  },
};
```

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
```

Events for one ordered sequence must be ordered, not omitted, and eventually
delivered. A response should reflect data at least as fresh as the moment its
request began. Infini replays newer local events over a late response.

If a previously exhausted side receives a new boundary item, call
`controller.reopen("after")` or `"before"` after applying the event.

## Provider checklist

- IDs are immutable, unique, and never reused.
- Every page is contiguous and in canonical order.
- Empty pages have the correct exhausted flags.
- Edge cursor inclusion is consistent and documented.
- `targetSize` influences batch size.
- `signal` reaches the transport.
- Remote travel has `locateOffset`, if the UI permits it.
- Tests cover delayed responses, overlap, empty sources, and real boundaries.
