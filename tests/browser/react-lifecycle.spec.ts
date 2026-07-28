import { expect, test } from "@playwright/test";

import { runFixture } from "./fixture-page.js";

test("keeps React portal identity and disposes after unmount", async ({
    page,
}, testInfo) => {
    const details = await runFixture(page, testInfo, "react-lifecycle");

    expect(details).toEqual({
        disposed: true,
        identityPreserved: true,
        updatedText: "updated",
    });
});
