import {
    createDomHarness,
    disposeDomHarness,
    startDomHarness,
    waitFor,
} from "../vite/support.js";

export async function run(): Promise<Record<string, unknown>> {
    const harness = createDomHarness();
    const { controller, dom, host, surface } = harness;
    await startDomHarness(harness);

    host.scrollTop = parseFloat(surface.style.height) - host.clientHeight;
    host.dispatchEvent(new Event("scroll"));
    await waitFor(
        () => surface.querySelector('[data-row="39"]') != null,
        "last existing row did not enter the bottom Layout",
    );
    controller.insertExternal({
        anchor: 39,
        side: "after",
        items: [{ id: 40, label: "appended", height: 60 }],
    });
    if (!dom.scrollToItem(40, "end")) {
        throw new Error(
            "newly appended Layout row rejected deferred end scroll",
        );
    }
    await waitFor(() => {
        const expectedBottom =
            parseFloat(surface.style.height) - host.clientHeight;
        return (
            surface.querySelector('[data-row="40"]') != null &&
            Math.abs(host.scrollTop - expectedBottom) <= 1
        );
    }, "deferred end scroll did not land at the measured surface bottom");

    const scrollTop = host.scrollTop;
    const expectedBottom = parseFloat(surface.style.height) - host.clientHeight;
    disposeDomHarness(harness);
    return { appendedRow: 40, expectedBottom, scrollTop };
}
