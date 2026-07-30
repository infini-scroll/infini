---
layout: page
title: Playground
description: Edit and run an Infini TypeScript demo in the browser.
aside: false
---

<div class="playground-page">
  <ClientOnly>
    <InfiniPlayground borderless />
  </ClientOnly>
</div>

<style>
.playground-page {
  height: calc(100dvh - var(--vp-nav-height));
}
</style>
