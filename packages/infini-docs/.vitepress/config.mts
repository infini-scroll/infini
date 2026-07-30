import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitepress";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isUserOrOrgPagesRepo =
    repository !== undefined && /\.github\.io$/i.test(repository);
const base =
    process.env.GITHUB_ACTIONS === "true" &&
    repository !== undefined &&
    !isUserOrOrgPagesRepo
        ? `/${repository}/`
        : "/";

export default defineConfig({
    base,
    title: "Infini",
    description: "The Engine for Your Long Content.",
    cleanUrls: true,
    head: [
        ["meta", { name: "theme-color", content: "#4265c5" }],
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
            { text: "Reference", link: "/reference/configuration" },
        ],
        sidebar: {
            "/guide/": [
                {
                    text: "Introduction",
                    items: [
                        { text: "Introduction", link: "/guide/introduction" },
                        { text: "Quick start", link: "/guide/quick-start" },
                        {
                            text: "Write your provider",
                            link: "/guide/provider",
                        },
                        {
                            text: "Navigation & live updates",
                            link: "/guide/navigation-and-updates",
                        },
                    ],
                },
            ],
            "/reference/": [
                {
                    text: "Reference",
                    items: [
                        {
                            text: "Configuration",
                            link: "/reference/configuration",
                        },
                        { text: "Controller", link: "/reference/controller" },
                        { text: "Snapshot", link: "/reference/snapshot" },
                        { text: "React wrapper", link: "/reference/react" },
                        {
                            text: "Headless interface (wip)",
                            link: "/reference/headless",
                        },
                    ],
                },
            ],
        },
        socialLinks: [
            { icon: "github", link: "https://github.com/infini-scroll/infini" },
        ],
        search: { provider: "local" },
        outline: { level: [2, 3] },
    },
});
