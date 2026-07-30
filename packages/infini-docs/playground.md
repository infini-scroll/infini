---
title: Playground
description: Edit and run an Infini TypeScript demo in the browser.
aside: false
---

# Playground

Edit the TypeScript source and press **Run**. The preview uses the current
`InfiniController` and `InfiniDomHost`; it is not a simulated list.

The playground compiles locally in the browser. Its only importable libraries
are:

- `@infini-scroll/core`
- `@infini-scroll/dom-support`

Browser APIs are available. Network imports and other packages are rejected.
The demo must export a `mount(context)` function and may return a cleanup
function.

<ClientOnly>
  <InfiniPlayground />
</ClientOnly>

## Things to try

Change `estimatedHeight` so it differs substantially from the rendered row
height. The first geometry will be less accurate, but DOM measurement should
settle it without losing the reading position.

Reduce `residentBefore` and `residentAfter` to `0`, or increase them to `100`.
The preview status shows how many items are mounted and how many are known in
the Main Island.

Change `FIRST_ID` and `LAST_ID`, then scroll to a real boundary. The Provider
sets `exhaustedBefore` and `exhaustedAfter` from those values.

Remove `locateOffset` and use ordinary nearby scrolling. Edge loading continues
to work; only distant travel through unknown content needs relative location.

## Runner contract

The editor receives this small host context:

```ts
type PlaygroundContext = {
  surface: HTMLElement;
  viewport: HTMLElement;
  report(message: string): void;
};
```

The expected module shape is:

```ts
export async function mount(context: PlaygroundContext) {
  // Create the Provider, controller, and DOM host.

  return () => {
    // Dispose listeners, host, and controller.
  };
}
```

The runner disposes the previous demo before every execution. Use **Reset** to
restore the complete starter source.
