import { createHighlighter, type BundledLanguage } from "shiki";
import { defineLoader } from "vitepress";
import { codeBlocks } from "./sources";

function withVitePressChrome(
    language: BundledLanguage,
    highlightedCode: string,
) {
    return [
        `<div class="language-${language}">`,
        '<button title="Copy Code" class="copy"></button>',
        `<span class="lang">${language}</span>`,
        highlightedCode,
        "</div>",
    ].join("");
}

export default defineLoader({
    watch: ["./sources.ts"],
    async load() {
        const languages = [
            ...new Set(Object.values(codeBlocks).map(({ lang }) => lang)),
        ] as BundledLanguage[];
        const highlighter = await createHighlighter({
            langs: languages,
            themes: ["github-light", "github-dark"],
        });

        try {
            return Object.fromEntries(
                Object.entries(codeBlocks).map(([name, { lang, source }]) => [
                    name,
                    withVitePressChrome(
                        lang,
                        highlighter.codeToHtml(source, {
                            lang,
                            themes: {
                                light: "github-light",
                                dark: "github-dark",
                            },
                            defaultColor: false,
                        }),
                    ),
                ]),
            ) as Record<keyof typeof codeBlocks, string>;
        } finally {
            highlighter.dispose();
        }
    },
});
