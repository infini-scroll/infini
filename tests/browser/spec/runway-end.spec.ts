import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("aligns a resized last item at an open-before content end", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "runway-end");

    expect(details.runwayOrigin).toBeGreaterThan(0);
    expect(details.itemBottom).toBe(details.viewportBottom);
});
