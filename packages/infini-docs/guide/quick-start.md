---
title: Quick start
description: Learn to build a bidirectional, variable-height feed with React.
---

# Quick start

The following example creates a React message feed. It starts at the Provider's
default position and loads older or newer messages as needed.

## Install

```sh
npm add @infini-scroll/core @infini-scroll/react --save
# or pnpm
pnpm add @infini-scroll/core @infini-scroll/react --save
# or yarn
yarn add @infini-scroll/core @infini-scroll/react --save
```

Infini depends on WebAssembly. Initialize it once before rendering a controller. Your bundler should be able to handle it:

```tsx
import { initializeInfini } from "@infini-scroll/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function main() {
  await initializeInfini();
  createRoot(document.getElementById("root")!).render(<App />);
}

main();
```

## Define the item and Provider

Each item needs an unique, immutable ID.
It is how Infini recognizes the same logical record across overlapping requests.

Items **CAN NOT** be reordered. Use a new ID for that purpose.

```ts
type Message = {
  id: string;
  createdAt: string;
  author: string;
  body: string;
};
```

For this example, a small in-memory backend keeps the focus on the Provider
contract. Its array is sorted by timestamp, just as a real backend would return
messages in timeline order:

```ts
class MyBackend {
  constructor(private readonly messages: readonly Message[]) {}

  around(timestamp: string | null, pageSize: number, signal: AbortSignal) {
    signal.throwIfAborted();

    if (timestamp === null) {
      return this.page(Math.max(0, this.messages.length - pageSize));
    }

    const middle = this.lowerBound(timestamp);
    const start = Math.min(
      Math.max(0, middle - Math.floor(pageSize / 2)),
      Math.max(0, this.messages.length - pageSize),
    );
    return this.page(start, pageSize);
  }

  fromEdge(
    timestamp: string,
    direction: "before" | "after",
    pageSize: number,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();

    // Include the edge item. Infini deduplicates it by ID, and the overlap
    // proves that this page is continuous with the known items.
    if (direction === "before") {
      const end = this.upperBound(timestamp);
      return this.page(Math.max(0, end - pageSize), pageSize);
    }

    return this.page(this.lowerBound(timestamp), pageSize);
  }

  locateRelative(timestamp: string, offset: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const index = Math.max(
      0,
      Math.min(this.messages.length - 1, this.lowerBound(timestamp) + offset),
    );
    const message = this.messages[index];
    return { cursor: message.createdAt, targetId: message.id };
  }

  private page(start: number, pageSize = this.messages.length) {
    const end = Math.min(this.messages.length, start + pageSize);
    return {
      items: this.messages.slice(start, end),
      exhaustedBefore: start === 0,
      exhaustedAfter: end === this.messages.length,
    };
  }

  private lowerBound(timestamp: string) {
    let low = 0;
    let high = this.messages.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.messages[middle].createdAt < timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  private upperBound(timestamp: string) {
    let low = 0;
    let high = this.messages.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.messages[middle].createdAt <= timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}

const messages: Message[] = Array.from({ length: 200 }, (_, index) => ({
  id: String(index + 1),
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  author: index % 2 === 0 ? "Ada" : "Lin",
  body: `Message ${index + 1}`,
}));

const backend = new MyBackend(messages);
```

The Provider has two required operations:

- `bootstrap` establishes a continuous group of items near a starting position
- `fetch` extends the known group before or after one of its edges

```ts
import type { Provider } from "@infini-scroll/core";

export const messageProvider: Provider<Message, string, string> = {
  async bootstrap({ cursor, targetSize, signal }) {
    return backend.around(cursor, rowsFor(targetSize), signal);
  },

  async fetch({ cursor, direction, targetSize, signal }) {
    return backend.fromEdge(cursor, direction, rowsFor(targetSize), signal);
  },
};

function rowsFor(targetSize: number) {
  return Math.ceil(targetSize / 76) + 4;
}
```

The public API calls the position value a `cursor`. It is an opaque bookmark
understood by your data source; it is not required to be a database cursor or
an item ID. The example uses `createdAt`, so the same timestamp can still
describe a position if the item that originally supplied it is later deleted.
The data model is discussed in [Choosing a cursor](#choosing-a-cursor).

Both Provider methods return:

```ts
type Page<T> = {
  items: readonly T[];
  exhaustedBefore: boolean;
  exhaustedAfter: boolean;
};
```

Items must be continuous and returned in normal content order. The boundary
flags state whether a real start or end has been reached.

### Render the feed

```tsx
import { InfiniList, useInfini } from "@infini-scroll/react";
import { messageProvider } from "./message-provider";

export function MessageFeed({ scrollHost }: { scrollHost?: HTMLElement }) {
  const { controller, snapshot } = useInfini<Message, string, string>({
    provider: messageProvider,
    ops: {
      getId: (message) => message.id,
      getCursor: (message) => message.createdAt,
    },
    estimateSize: () => 76,
    defaultItemEstimate: 76,
    initial: { cursor: null },
    residentBefore: 30,
    residentAfter: 30,
  }); // You don't have to use `useCallback` for getId, getCursor, estimateSize, etc.

  if (
    snapshot.phase.status === "dormant" ||
    snapshot.phase.status === "bootstrapping"
  ) {
    return <p>Loading messages…</p>;
  }

  if (snapshot.phase.status === "failed") {
    return (
      <div role="alert">
        <p>{snapshot.phase.error.message}</p>
        <button onClick={controller.retry}>Try again</button>
      </div>
    );
  }

  if (snapshot.phase.status === "ready" && snapshot.phase.empty) {
    return <p>No messages yet.</p>;
  }

  return (
    // Keep row contents in normal flow. Infini manages row positioning and
    // the list surface height.
    <InfiniList
      controller={controller}
      scrollHost={scrollHost} // Without `scrollHost`, the browser viewport (window) owns scrolling.
      rowClassName="message-shell"
      renderItem={(message) => <MessageRow message={message} />}
    />
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <article>
      <strong>{message.author}</strong>{" "}
      <time dateTime={message.createdAt}>
        {new Date(message.createdAt).toLocaleString()}
      </time>
      <p>{message.body}</p>
    </article>
  );
}
```

```css
.message-shell {
  width: 100%;
  padding: 6px 16px;
  box-sizing: border-box;
}
```

## What happens while the user scrolls

The first Provider result forms a continuous known region called the **Main
Island**. Infini measures its rows and mounts only the pixel range needed around
the viewport.

<figure class="concept-figure">
  <img src="/diagrams/windows.svg" alt="Visible nested inside Layout; Resident and Buffer extend around the layout items." />
  <figcaption>
    Visible is what the user can see. Layout adds measured pixel overscan.
    Resident and Buffer describe nearby items retained in memory.
  </figcaption>
</figure>

### Visible and Layout

**Visible** is the unobscured physical viewport. **Layout** adds pixel overscan
before and after it. Rows intersecting Layout are mounted and measured. More
overscan can absorb faster scrolling, but mounts more DOM.

### Resident and Buffer

**Resident** retains an item-count margin around Layout. It is useful for
nearby data subscriptions. When a Provider returns more than Resident
currently needs, those additional known items form **Buffer** and can be reused
without another request.

Layout is measured in pixels because row heights vary. Resident is counted in
items because subscriptions and memory budgets usually operate on records.

### Islands and unknown content

An **Island** is a region whose ordering and adjacency are known. Infini can
grow the Main Island by fetching from either edge. It does not assign permanent
pixel positions to all unseen records.

<figure class="concept-figure">
  <img src="/diagrams/islands.svg" alt="A main island surrounded by unknown content; after a jump an old island and a new main island remain separated until overlap is known." />
  <figcaption>
    A distant jump creates another exact local region. The gap is not treated
    as known merely because both regions have been loaded.
  </figcaption>
</figure>

For nearby scrolling, this behaves like a continuous document. For a distant
jump, Infini loads and hidden-measures a new region before showing it. Shared
stable IDs can later prove that two regions overlap and may be joined safely.

## Choosing a cursor

A cursor should describe where another request begins. It does not identify
the item for rendering—that is the stable ID's job.

For an ascending message timeline, `createdAt` can be a cursor. `MyBackend`
uses `lowerBound` and `upperBound` to find the insertion points immediately
before or after a timestamp. A `"before"` request then takes a slice ending at
that position:

```ts
const end = this.upperBound(timestamp);
const start = Math.max(0, end - pageSize);
const items = this.messages.slice(start, end);
```

This selects the messages at or before the timestamp and returns the slice in
the timeline's normal order, which is the order Infini expects.

If the message at exactly `timestamp` was deleted, the timestamp still
describes a valid location. This is one reason to keep stable identity and
request position as separate concepts:

```ts
ops: {
  getId: (message) => message.id,
  getCursor: (message) => message.createdAt,
}
```

If multiple rows can share a timestamp, use a compound value such as
`{ createdAt, id }` and a matching database condition. Cursors may also be
opaque server tokens. Infini stores and returns them without comparing them.

## Returning appropriately sized pages

`targetSize` is requested pixel coverage, not a fixed item count. The Provider
usually cannot know final DOM heights, so convert it with a reasonable estimate
and include a small margin:

```ts
const pageSize = Math.ceil(targetSize / 76) + 4;
```

Returning extra items is safe; they become Buffer. At a genuine content
boundary, return fewer items and set the matching `exhaustedBefore` or
`exhaustedAfter` flag.

An empty fetch must mark the requested side exhausted. Otherwise the same edge
would remain open and immediately need another request.

## Using an overflow container

Render the feed only after the container ref exists:

```tsx
function FeedPanel() {
  const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setScrollHost} className="feed-viewport">
      {scrollHost ? <MessageFeed scrollHost={scrollHost} /> : null}
    </div>
  );
}
```

```css
.feed-viewport {
  height: 70vh;
  overflow: auto;
  overscroll-behavior: contain;
}
```

If a fixed toolbar covers part of the viewport, pass its size as
`paddingStart` or `paddingEnd`. Do not use these props for ordinary in-flow
padding.

## Distant scrollbar travel

Ordinary edge fetching does not require random access. If the UI allows the
user to drag far into unknown content, add the optional `locateOffset`
operation:

```ts
async locateOffset({ anchor, signedItemOffset, signal }) {
  return backend.locateRelative(anchor.createdAt, signedItemOffset, signal);
}
```

Its result may be approximate. Infini follows it with a normal bootstrap and
DOM measurement, so the destination becomes locally exact.

## Next steps

- Read [Provider contract](/guide/provider) before connecting production data.
- Use the [React wrapper guide](/guide/react) for lifecycle, alignment, and
  reading-position patterns.
- Use the [Headless interface](/guide/headless) with Vue, Svelte, Solid, or
  custom DOM rendering.
- Modify and run a complete example in the [Playground](/playground).

## Custom Wasm loading

Pass a URL, `Response`, byte buffer, or compiled `WebAssembly.Module` when the
default asset location is unsuitable:

```ts
await initializeInfini(new URL("/assets/infini_wasm_bg.wasm", location.href));
```

With server-side rendering, initialize in a browser entry point. Controllers
and DOM hosts require the initialized module and a live document.
