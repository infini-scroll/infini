import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "infini-core": fileURLToPath(
                new URL("../infini-core/src/index.ts", import.meta.url),
            ),
            "infini-dom-support": fileURLToPath(
                new URL("../infini-dom-support/src/index.ts", import.meta.url),
            ),
            "infini-react": fileURLToPath(
                new URL("../infini-react/src/index.ts", import.meta.url),
            ),
        },
    },
});
