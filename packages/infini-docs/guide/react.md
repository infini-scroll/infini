---
title: React wrapper
description: Use useInfini and InfiniList in a React application.
---

# React wrapper

The React package is the shortest integration path. `useInfini` owns a
controller for one component lifetime; `InfiniList` owns physical DOM layout
while React renders each row through a portal.

```tsx
import { InfiniList, useInfini } from "@infini-scroll/react";
```

## `useInfini`

```tsx
const { controller, snapshot } = useInfini(config);
```

The hook:

- constructs one `InfiniController`;
- subscribes the component to immutable snapshots;
- starts the initial bootstrap after mount;
- disposes the controller on permanent unmount;
- tolerates React Strict Mode's immediate effect replay.

The initial config is treated as immutable. Recreating the object during render
does not reconfigure or replace the controller. If the account, Provider,
dataset, or stable-ID domain changes, remount the component with a different
React `key`.

`debug` is the one config field synchronized after creation:

```tsx
debug: import.meta.env.DEV ? "InboxFeed" : undefined;
```

## `InfiniList`

```tsx
<InfiniList
    controller={controller}
    renderItem={(item, id) => <MessageRow key={id} item={item} />}
/>
```

The component renders a relative-height scroll surface. It owns stable row
shells, measurement, layout acknowledgement, focus retention, and scroll
correction. React owns the portal contents inside each shell.

This boundary matters: Infini may move a row shell as the Layout window changes,
but the portal identity stays stable, so row component state is preserved.

### Props

| Prop                          | Meaning                                            | Default               |
| ----------------------------- | -------------------------------------------------- | --------------------- |
| `controller`                  | Long-lived controller returned by `useInfini`      | required              |
| `renderItem(item, id)`        | React content for a stable row shell               | required              |
| `scrollHost`                  | Browser `window` or an overflow element            | `window`              |
| `paddingStart`, `paddingEnd`  | Fixed-overlay insets in CSS pixels                 | `0`                   |
| `layoutBefore`, `layoutAfter` | Pixel overscan                                     | one viewport per side |
| `anchorRatio`                 | Compensation waterline in Visible, from `0` to `1` | `0`                   |
| `className`, `style`          | Surface presentation                               | none                  |
| `rowClassName`                | Class applied to every row shell                   | none                  |
| `onHostChange`                | Receives the mounted DOM host and later `null`     | none                  |

Do not override the surface `height` or `position` through `style`; those are
owned by the adapter.

## Rendering lifecycle states

`snapshot.phase` describes the foreground experience:

```tsx
function FeedStatus({ snapshot, controller }) {
    switch (snapshot.phase.status) {
        case "dormant":
        case "bootstrapping":
            return <Spinner />;
        case "seeking":
            return <SmallProgressLabel>Finding messages…</SmallProgressLabel>;
        case "failed":
            return (
                <ErrorBanner
                    error={snapshot.phase.error}
                    onRetry={controller.retry}
                />
            );
        case "ready":
            return snapshot.phase.empty ? <EmptyState /> : null;
    }
}
```

During `seeking`, an existing Main Island can remain usable. Keep the list
mounted and show a lightweight progress indicator instead of replacing it with
a full-page spinner.

Edge loading is independent of foreground phase:

```tsx
{
    snapshot.loadingBefore && <TopLoadingIndicator />;
}
{
    snapshot.loadingAfter && <BottomLoadingIndicator />;
}
```

## Scrolling to an item

Capture the DOM host when you need physical item alignment:

```sh
pnpm add @infini-scroll/dom-support
```

```tsx
import type { InfiniDomHost } from "@infini-scroll/dom-support";

const hostRef = useRef<InfiniDomHost<Message, string, string> | null>(null);

<InfiniList
    controller={controller}
    onHostChange={(host) => (hostRef.current = host)}
    renderItem={(message) => <MessageRow message={message} />}
/>;
```

For a nearby item:

```ts
hostRef.current?.scrollToItem(messageId, "center");
```

If it returns `false`, the item is outside Layout. Start a data jump as the
fallback; the host remembers the requested final alignment:

```ts
if (!hostRef.current?.scrollToItem(messageId, "center")) {
    controller.jump(messageId, { alignment: "center" });
}
```

This requires `targetToCursor` and usually `locateTarget` in controller config.
See [Navigation & live updates](/guide/navigation-and-updates).

## Saving reading position

Use a stable item ID, not `scrollTop`:

```ts
const row = controller.getVisibleItem(0.25);
if (row) saveReadingPosition({ messageId: row.id });
```

On the next mount, pass the saved target:

```ts
initial: {
  cursor: null,
  target: saved.messageId,
  alignment: "start",
},
targetToCursor: (id) => id,
locateTarget: (items, id) =>
  items.some((item) => item.id === id) ? id : null,
```

A raw pixel position is tied to old measurements and old content. A stable ID
survives inserts, deletes, and responsive layout changes.

## Row design guidance

- Let rows participate in normal block flow.
- Use stable business identity; do not synthesize IDs from array positions.
- Prefer CSS margins inside a row shell or shell padding. Margin collapse
  between independent row roots is hard to reason about.
- Images should have dimensions or aspect ratios where possible. Late size
  changes are supported, but avoiding unnecessary reflow still improves polish.
- Keep focused controls inside the rendered row. The DOM host pins focused rows
  while needed so virtualization does not unexpectedly discard focus.

## Changing viewport policy

Changing geometry props recreates the DOM host but preserves the controller and
known data. For frequent imperative changes, keep the host from
`onHostChange` and call:

```ts
host.setViewportOptions({
    paddingStart: toolbarHeight,
    layoutAfter: 1200,
    anchorRatio: 0.25,
});
```

The [configuration reference](/reference/configuration) explains the tuning
values.
