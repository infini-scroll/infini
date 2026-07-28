import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("physically aligns an end target after seek", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "seek-alignment");

    expect(details.liveTargetRectReads).toBeGreaterThan(0);
    expect(details.itemBottom).toBe(details.viewportBottom);
});
