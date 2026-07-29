import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/browser",
    testMatch: "*.spec.ts",
    outputDir: "./node_modules/.playwright-temp",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["github"], ["line"]] : "line",
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "pnpm run test:browser:serve",
        url: "http://127.0.0.1:4173/host.html",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: "chromium",
            use: { browserName: "chromium" },
        },
    ],
});
