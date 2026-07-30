---
title: Quick start
description: Learn to build a bidirectional, variable-height feed with React.
---

<script setup lang="ts">
import { data as highlightedCodeBlocks } from "../.vitepress/sources.data";
</script>

# Quick start

The following example creates a React message feed. It opens on the exact first
unread message and loads older or newer messages as needed.

## Install

::: code-group

```sh [npm]
npm install --save @infini-scroll/core @infini-scroll/react
```

```sh [pnpm]
pnpm add --save @infini-scroll/core @infini-scroll/react
```

```sh [yarn]
yarn add --save @infini-scroll/core @infini-scroll/react
```

:::

Infini depends on WebAssembly. Initialize it once before rendering a controller. Your bundler should be able to handle it:

<div v-html="highlightedCodeBlocks.quickStartInitialize"></div>

## Walkthrough

### Item

Each item needs an unique, immutable ID.
It is how Infini recognizes the same logical record across overlapping requests.

Items **CAN NOT** be reordered. Use a new ID for that purpose.

<div v-html="highlightedCodeBlocks.quickStartMessage"></div>

### Backend

For this example, we would use a simple in-memory backend.

Messages are ordered by timestamp, and that timestamp is also a stable cursor. The timestamp remains meaningful even if the message at that position is later deleted.

<div v-html="highlightedCodeBlocks.quickStartBackend"></div>

### Provider

The Provider has two required operations:

- `bootstrap` establishes a continuous group of items near a starting position
- `fetch` extends the known group before or after one of its edges

<div v-html="highlightedCodeBlocks.quickStartProvider"></div>

The public API calls the position value a `cursor`. It is an opaque bookmark
understood by your data source; it is not required to be a database cursor or
an item ID. The example uses `createdAt`, so the same timestamp can still
describe a position if the item that originally supplied it is later deleted.
The data model is discussed in [Choosing a cursor](#choosing-a-cursor).

Both Provider methods return:

<div v-html="highlightedCodeBlocks.quickStartPageType"></div>

Items must be continuous and returned in normal content order. The boundary
flags state whether a real start or end has been reached.

### Render the feed

<div v-html="highlightedCodeBlocks.quickStartReact"></div>

<div v-html="highlightedCodeBlocks.quickStartCss"></div>

The initial `target` identifies the exact first unread row. `cursor` tells the
Provider where to load, while `locateTarget` lets Infini align that row rather
than merely the surrounding page. `InfiniList` stays mounted while the Provider
bootstraps so its DOM host can apply that initial alignment. The button uses the
same exact-target path to jump to the final message.

## Try it

<ClientOnly>
  <InfiniPlayground inline />
</ClientOnly>

## Behind the scene

The first Provider result forms a continuous known region —— the **Main
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

<div v-html="highlightedCodeBlocks.quickStartCursorSlice"></div>

This selects the messages at or before the timestamp and returns the slice in
the timeline's normal order, which is the order Infini expects.

If the message at exactly `timestamp` was deleted, the timestamp still
describes a valid location. This is one reason to keep stable identity and
request position as separate concepts:

<div v-html="highlightedCodeBlocks.quickStartOps"></div>

If multiple rows can share a timestamp, use a compound value such as
`{ createdAt, id }` and a matching database condition. Cursors may also be
opaque server tokens. Infini stores and returns them without comparing them.

## Returning appropriately sized pages

`targetSize` is requested pixel coverage, not a fixed item count. The Provider
usually cannot know final DOM heights, so convert it with a reasonable estimate
and include a small margin:

<div v-html="highlightedCodeBlocks.quickStartPageSize"></div>

Returning extra items is safe; they become Buffer. At a genuine content
boundary, return fewer items and set the matching `exhaustedBefore` or
`exhaustedAfter` flag.

An empty fetch must mark the requested side exhausted. Otherwise the same edge
would remain open and immediately need another request.

## Using an overflow container

Render the feed only after the container ref exists:

<div v-html="highlightedCodeBlocks.quickStartFeedPanel"></div>

<div v-html="highlightedCodeBlocks.quickStartViewportCss"></div>

If a fixed toolbar covers part of the viewport, pass its size as
`paddingStart` or `paddingEnd`. Do not use these props for ordinary in-flow
padding.

## Distant scrollbar travel

Ordinary edge fetching does not require random access. If the UI allows the
user to drag far into unknown content, add the optional `locateOffset`
operation:

<div v-html="highlightedCodeBlocks.quickStartLocateOffset"></div>

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

<div v-html="highlightedCodeBlocks.quickStartCustomWasm"></div>

With server-side rendering, initialize in a browser entry point. Controllers
and DOM hosts require the initialized module and a live document.
