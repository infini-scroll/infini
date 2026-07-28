import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("commits a virtualized flow layout without live row reads", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "dom-layout");

    expect(details).toMatchObject({
        liveDuringBootstrap: 0,
        liveRowRectReads: 0,
        surfaceHeight: 960,
    });
});
