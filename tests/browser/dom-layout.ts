import {
    createDomHarness,
    disposeDomHarness,
    startDomHarness,
    waitFor,
} from "./support.js";

export async function run(): Promise<Record<string, unknown>> {
    const harness = createDomHarness();
    const { host, surface } = harness;
    const liveDuringBootstrap = surface.querySelectorAll(
        "[data-infini-live-track] > [data-row]",
    ).length;

    await startDomHarness(harness);

    const stagedAfterCommit = surface.querySelector(
        "[data-infini-staging] [data-row]",
    );
    const liveTrack = surface.querySelector<HTMLElement>(
        "[data-infini-live-track]",
    );
    const liveAfterCommit = surface.querySelectorAll(
        "[data-infini-live-track] > [data-row]",
    ).length;
    if (stagedAfterCommit) {
        throw new Error("candidate rows remained mounted after commit");
    }
    if (!liveTrack || !liveTrack.style.transform) {
        throw new Error("flow-based live track was not installed");
    }
    if (
        [...liveTrack.querySelectorAll<HTMLElement>("[data-row]")].some(
            (node) => node.style.transform !== "none",
        )
    ) {
        throw new Error("a live row retained its own positioning transform");
    }
    if (liveAfterCommit >= 40) {
        throw new Error("layout virtualization did not evict rows");
    }

    const surfaceHeight = parseFloat(surface.style.height);
    if (Math.abs(surfaceHeight - 960) > 0.5) {
        throw new Error(
            `unexpected measured surface height ${surface.style.height}`,
        );
    }

    const originalRowRect = HTMLElement.prototype.getBoundingClientRect;
    let liveRowRectReads = 0;
    HTMLElement.prototype.getBoundingClientRect = function () {
        if (this.dataset.row) liveRowRectReads += 1;
        return originalRowRect.call(this);
    };
    try {
        host.scrollTop = 180;
        host.dispatchEvent(new Event("scroll"));
        await waitFor(
            () => surface.querySelector('[data-row="20"]') != null,
            "flow track did not batch the next Layout rows",
        );
    } finally {
        HTMLElement.prototype.getBoundingClientRect = originalRowRect;
    }
    if (liveRowRectReads !== 0) {
        throw new Error(
            `performLayout synchronously measured ${liveRowRectReads} live rows`,
        );
    }

    disposeDomHarness(harness);
    return {
        liveAfterCommit,
        liveDuringBootstrap,
        liveRowRectReads,
        surfaceHeight,
    };
}
