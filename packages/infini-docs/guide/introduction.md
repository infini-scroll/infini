---
title: Introduction
description: Understand what Infini is and what it is for.
---

# Introduction

Infini is a scrolling library for long ordered content that may extend
in both directions. It renders only the part of the document near the viewport,
measures rows after they reach the DOM, and requests more data as the user
moves.

You provide ordered items and a small data-loading interface. You integrate it with the React wrapper, or use the same scrolling behavior with another framework through the headless DOM interface.

[Quick start](./quick-start.md) demonstrates how you can build a bidirectional, variable-height feed with Infini React.

## Why Infini

### Rendering the complete list is slow

Rendering every row is simple and correct for small collections. It becomes
expensive when thousands of components, observers, images, and layout boxes
remain mounted. Infini keeps the DOM close to the current viewport while the
logical collection can be much larger.

### Pagination does not suit

Pagination is a good choice when explicit page boundaries suit.
Infini is for a continuous reading experience: the user scrolls naturally,
content can be prepended without moving the reading position, and a saved or
searched item can become the starting point.

### Virtual lists

Many virtual lists work best when the application knows the total item count and start from the start or bottom. Those assumptions fit tables and local arrays. However, they fit chats and live feeds less well.

- In chats, we might start from where we left (like Discord) without loading the latest message very early. We might need to click on a reply to see its original message. We might also need to scroll around to see its context. Furthermore, a single message can grow or shrink anytime, for example, when a message is edited or redacted.
- In live feeds, the total is not finite (like X); as user scrolls, feeds accumulates and the memory usage keeps go up if not handled properly.

### Maintaining scroll position manually can leads to subtle bugs.

Prepending data, image loading, text reflow can all change row heights above the viewport, potentially causing visual flickering.
Infini measures the resulting DOM and compensates the scroll position around a content anchor and the user remains at the same semantic position when layout changes.

## Use cases

Infini is intended for feeds where loading the full collection is either
impossible or undesirable:

- a conversation opened around its unread message (instead of latest message);
- a timeline that can grow at both ends;
- audit logs with millions of records;
- a text reader that restores a saved paragraph (without having to load earlier pages).

## Features

- Bidirectional loading from any initial position
- Variable-height rows measured from the final DOM
- Stable position during prepends and height changes with anchoring
- Distant jumps without loading intermediate item
- Fast, predictive seek to navigate faster, even if items are not loaded
- Live inserts, deletes, and content updates
- Global-free view model
- React support + Headless APIs
