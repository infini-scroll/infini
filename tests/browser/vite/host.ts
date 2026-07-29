/// <reference types="vite/client" />

import { initializeInfini } from "infini-core";

import type { BrowserResult } from "./support.js";

interface FixtureModule {
    run(): Promise<Record<string, unknown>> | Record<string, unknown>;
}

const fixtures = import.meta.glob<FixtureModule>("./*.{ts,tsx}");

async function run(): Promise<Record<string, unknown>> {
    const fixture = new URLSearchParams(window.location.search).get("fixture");
    const load =
        fixture == null
            ? undefined
            : (fixtures[`./${fixture}.ts`] ?? fixtures[`./${fixture}.tsx`]);
    if (!load) {
        throw new Error(`unknown browser fixture: ${fixture ?? "(missing)"}`);
    }

    await initializeInfini();
    const module = await load();
    return module.run();
}

void run().then(
    (details) => {
        window.__infiniResult = { ok: true, details };
    },
    (error: unknown) => {
        const result: BrowserResult = {
            ok: false,
            error: error instanceof Error ? error.stack : String(error),
        };
        window.__infiniResult = result;
    },
);
