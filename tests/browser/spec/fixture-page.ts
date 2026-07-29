import { expect, type Page, type TestInfo } from "@playwright/test";

interface BrowserResult {
    ok: boolean;
    error?: string;
    details?: Record<string, unknown>;
}

export async function runFixture(
    page: Page,
    testInfo: TestInfo,
    fixture: string,
): Promise<Record<string, unknown>> {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
        pageErrors.push(error.stack ?? error.message);
    });

    await page.goto(`/host.html?fixture=${encodeURIComponent(fixture)}`);
    await page.waitForFunction(
        //@ts-ignore
        () => window.__infiniResult != null,
    );
    const result = await page.evaluate<BrowserResult | undefined>(
        //@ts-ignore
        () => window.__infiniResult,
    );

    await testInfo.attach(`${fixture}-details`, {
        body: JSON.stringify(result?.details ?? {}, null, 2),
        contentType: "application/json",
    });

    expect(pageErrors, "browser page errors").toEqual([]);
    expect(
        result?.ok,
        result?.error ?? "browser fixture returned no result",
    ).toBe(true);
    return result?.details ?? {};
}
