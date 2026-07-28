import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("preserves focus and the waterline across DOM mutations", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "dom-mutations");

    expect(details.compensatedBy).toBeGreaterThan(0);
    expect(details).toMatchObject({
        focusedAfterWindowShift: true,
        identityPreserved: true,
    });
});
