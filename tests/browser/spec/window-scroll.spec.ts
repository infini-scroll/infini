import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("uses surface-local coordinates with the window scroll host", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "window-scroll");

    expect(details.surfaceOffset).toBeGreaterThan(0);
    expect(details.lastBottom).toBe(details.expectedLastBottom);
});
