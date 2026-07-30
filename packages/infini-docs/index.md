---
layout: home

hero:
  name: "Infini"
  text: "A small DOM for a very long feed."
  tagline: Virtual scrolling for bidirectional, variable-height content—without requiring a total count or a global item index.
  image:
    src: /infini-mark.svg
    alt: Infini
  actions:
    - theme: brand
      text: Introduction
      link: /guide/introduction
    - theme: alt
      text: Playground
      link: /playground

features:
  - icon: ↕
    title: Scroll in both directions
    details: Start around any item, fetch before and after, and jump to distant content without loading everything in between.
  - icon: ◫
    title: Variable-height rows
    details: Real DOM measurements refine estimates while anchor compensation keeps the user's reading position steady.
  - icon: ◌
    title: Framework or headless
    details: Use the React wrapper for the shortest path, or combine the controller with the framework-neutral DOM host.
---

## What Infini is

Infini renders the useful part of a long ordered feed and keeps a modest amount
of nearby data ready. It is designed for chat histories, timelines, logs,
readers, audit trails, and similar surfaces where:

- content can continue before and after the current position;
- row heights are not known until they are rendered;
- users may open or jump to a position in the middle.

Infini does **not** prescribe your API, cache, item markup, or visual design. Your
application supplies an ordered `Provider`; Infini decides what nearby content
to request and what small set of rows to mount.

## Choose an integration

| If you are building…                         | Start with…                                   | You provide…                              |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| A React list or feed                         | [React wrapper](/guide/react)                 | A Provider and `renderItem`               |
| Vue, Svelte, Solid, or custom DOM UI         | [Headless interface](/guide/headless)         | A Provider and row lifecycle hooks        |
| A non-DOM renderer or a new platform adapter | [Controller reference](/reference/controller) | Measurement, layout, and scroll execution |

The [tutorial](/guide/introduction.md) uses React and explains
the Provider contract along the way. The [Playground](/playground) runs the
headless DOM integration against an in-memory Provider.

## What the user experiences

Nearby scrolling feels like a normal continuous document. Rows can change
height, older rows can be prepended, and the viewport remains anchored to the
same content. When a user travels beyond the accurately known neighborhood,
Infini establishes another local neighborhood instead of pretending it knows
the exact height of everything in between.
