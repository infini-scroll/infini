import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@infini-scroll/core": fileURLToPath(
                new URL("../infini-core/src/index.ts", import.meta.url),
            ),
            "@infini-scroll/dom-support": fileURLToPath(
                new URL("../infini-dom-support/src/index.ts", import.meta.url),
            ),
            "@infini-scroll/react": fileURLToPath(
                new URL("../infini-react/src/index.ts", import.meta.url),
            ),
        },
    },
});
