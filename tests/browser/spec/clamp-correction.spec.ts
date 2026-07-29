import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("acknowledges the browser-clamped scroll correction", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "clamp-correction");

    expect(details).toEqual({
        acknowledgedScroll: 100,
        clampedLanding: 100,
    });
});
