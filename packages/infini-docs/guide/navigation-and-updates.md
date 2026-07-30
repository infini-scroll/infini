---
title: Navigation and live updates
description: Jump to distant content, restore position, and apply external changes.
---

# Navigation and live updates

Infini separates physical scrolling from data navigation. Nearby rows can be
aligned immediately; distant targets first need a Provider bootstrap.

## Configure application targets

`TTarget` is an application-level value such as a message ID, timestamp, search
result, or compound route object.

```ts
type Target = { messageId: string };

const controller = new InfiniController<Message, string, string, Target>({
    // shared Provider, ops, and size configuration…
    initial: {
        cursor: null,
        target: routeTarget,
        alignment: "center",
    },
    targetToCursor: (target) => target.messageId,
    locateTarget: (items, target) =>
        items.find((item) => item.id === target.messageId)?.id ?? null,
});
```

`targetToCursor` tells the Provider where to bootstrap.
`locateTarget` identifies the exact stable row within the returned page.
Without `locateTarget`, the page can still load, but Infini cannot guarantee
exact item alignment.

## Jump at runtime

```ts
controller.jump(
    { messageId: result.id },
    { direction: "after", alignment: "center" },
);
```

`direction` describes where detached old content should be retained relative to
the new Main Island. It is not a scroll animation direction. `"after"` is the
default and is appropriate for many forward-reading feeds.

The returned number is a diagnostic effect ticket; most applications do not
need to store it.

## Alignment

| Value       | Result                                          |
| ----------- | ----------------------------------------------- |
| `"start"`   | Target at the unobscured viewport start         |
| `"center"`  | Target centered in the unobscured viewport      |
| `"end"`     | Target at the unobscured viewport end           |
| `"nearest"` | Smallest movement that fully reveals the target |

Fixed-overlay insets are respected.

## Restore reading position

Persist a stable item ID:

```ts
const visible = controller.getVisibleItem(0.25);
if (visible) {
    localStorage.setItem("reading-item", String(visible.id));
}
```

The ratio is a waterline within Visible: `0` is the start, `0.5` the middle.
On restoration, use the saved value as `initial.target`. If you need position
within a very tall item, persist an application-defined intra-item offset too.

## Inserts

Apply a contiguous ordered insertion next to a known anchor:

```ts
controller.insertExternal({
    anchor: "message-42",
    side: "after",
    items: [newMessageA, newMessageB],
});
```

The return value is the number of known Island occurrences updated. Zero means
the anchor is not currently known; Infini cannot infer a global position from
the event alone. A later Provider page can bring those items into view.

## Deletes

```ts
controller.deleteExternal(["message-42", "message-43"]);
```

Deleted IDs become tombstones. A late response cannot accidentally revive
them, and the IDs must never be reused for different logical items.

## Content updates

```ts
controller.updateExternal([editedMessage]);
```

This replaces the business object without changing identity or order. If the
rendered height changes, the DOM host measures it and compensates the viewport.
A reorder is not an update: express it as delete plus insert with a new ID.

## Reopening a content boundary

If a side was proven exhausted and later receives new content:

```ts
controller.insertExternal({
    anchor: previousLastId,
    side: "after",
    items: [newLastMessage],
});
controller.reopen("after");
```

Reopening tells the work loop that more edge requests are meaningful again.

## Limiting retained Buffer

Provider responses may leave known items beyond Resident. Trim them explicitly
when your application has a strict business-object memory budget:

```ts
controller.trimBuffer("before", 200);
controller.trimBuffer("after", 400);
```

Resident or pinned items are never removed. Trimming affects retained data, not
the current Layout window.
