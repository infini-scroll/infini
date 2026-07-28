import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("lands a deferred end scroll after an append is measured", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "dom-append");

    expect(details).toMatchObject({ appendedRow: 40 });
    expect(details.scrollTop).toBe(details.expectedBottom);
});
