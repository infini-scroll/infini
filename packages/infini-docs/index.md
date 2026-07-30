---
layout: home

hero:
    name: "Infini"
    text: "The Engine\nfor Your Long Content."
    tagline: Fast, coherent navigating through massive information — by controlling what stays in the viewport, and what stays in memory.
    actions:
        - theme: brand
          text: Introduction
          link: /guide/introduction
        - theme: alt
          text: Try it in your browser
          link: /playground
---

<script setup>
import {
    faArrowUpWideShort,
    faBarsStaggered,
    faUpDownLeftRight,
    faCircleDot
} from "@fortawesome/free-solid-svg-icons";

const features = [
    {
        icon: faUpDownLeftRight,
        title: "Start from any place,\nscroll to anywhere",
        details:
            "Start from the middle, scroll up and down faster than content loading, without loading everything in between.",
    },
    {
        icon: faArrowUpWideShort,
        title: "Distant jump",
        details:
            "Finding or referring to something? Jump directly with absolute IDs.",
    },
    {
        icon: faBarsStaggered,
        title: "Variable-height rows",
        details:
            "Real item measurements refine estimates while anchor compensation keeps the user's reading position steady and stable.",
    },
    {
        icon: faCircleDot,
        title: "Framework-agnostic",
        details:
            "The library itself is headless, with bindings for React for now. Will support more your favorite tooling soon :)",
    },
];
</script>

<HomeFeatures :features="features" />
