import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitepress";

export default defineConfig({
    title: "Infini",
    description:
        "A virtual scrolling engine for long, bidirectional, variable-height feeds.",
    cleanUrls: true,
    head: [
        ["meta", { name: "theme-color", content: "#6955d9" }],
        [
            "link",
            { rel: "icon", href: "/infini-mark.svg", type: "image/svg+xml" },
        ],
    ],
    vite: {
        resolve: {
            alias: {
                "@infini-scroll/core": fileURLToPath(
                    new URL("../../infini-core/src/index.ts", import.meta.url),
                ),
                "@infini-scroll/dom-support": fileURLToPath(
                    new URL(
                        "../../infini-dom-support/src/index.ts",
                        import.meta.url,
                    ),
                ),
            },
        },
    },
    themeConfig: {
        logo: "/infini-mark.svg",
        nav: [
            { text: "Guides", link: "/guide/introduction" },
            { text: "Playground", link: "/playground" },
            { text: "API", link: "/reference/configuration" },
        ],
        sidebar: {
            "/guide/": [
                {
                    text: "Introduction",
                    items: [
                        { text: "Introduction", link: "/guide/introduction" },
                        { text: "Quick start", link: "/guide/quick-start" },
                        { text: "Provider contract", link: "/guide/provider" },
                    ],
                },
                {
                    text: "Using Infini",
                    items: [
                        { text: "React wrapper", link: "/guide/react" },
                        { text: "Headless interface", link: "/guide/headless" },
                        {
                            text: "Navigation & live updates",
                            link: "/guide/navigation-and-updates",
                        },
                        {
                            text: "Errors & troubleshooting",
                            link: "/guide/errors",
                        },
                    ],
                },
            ],
            "/reference/": [
                {
                    text: "API reference",
                    items: [
                        {
                            text: "Configuration",
                            link: "/reference/configuration",
                        },
                        { text: "Controller", link: "/reference/controller" },
                        { text: "Snapshot", link: "/reference/snapshot" },
                    ],
                },
            ],
        },
        socialLinks: [
            { icon: "github", link: "https://github.com/infini-scroll/infini" },
        ],
        search: { provider: "local" },
        outline: { level: [2, 3] },
        footer: {
            message: "Released under the Apache-2.0 License.",
            copyright: "Infini",
        },
    },
});
