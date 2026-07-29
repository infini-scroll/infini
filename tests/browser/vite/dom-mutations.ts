import {
    createDomHarness,
    disposeDomHarness,
    nextFrame,
    startDomHarness,
    waitFor,
} from "../vite/support.js";

export async function run(): Promise<Record<string, unknown>> {
    const harness = createDomHarness();
    const { controller, dom, host, surface } = harness;
    await startDomHarness(harness);

    if (!dom.scrollToItem(5, "start")) {
        throw new Error("laid-out item refused an imperative local scroll");
    }
    await nextFrame();
    if (Math.abs(host.scrollTop - 120) > 1) {
        throw new Error(`imperative local scroll landed at ${host.scrollTop}`);
    }

    const stable = surface.querySelector<HTMLElement>('[data-row="5"]')!;
    const focused = stable.querySelector("input")!;
    focused.focus();
    const beforeTop = stable.getBoundingClientRect().top;
    const beforeScroll = host.scrollTop;
    controller.insertExternal({
        anchor: 0,
        side: "before",
        items: [{ id: 1000, label: "prepended", height: 35 }],
    });
    await waitFor(
        () => host.scrollTop > beforeScroll,
        "prepend scroll compensation was not applied",
    );
    await nextFrame();

    const stableAfter = surface.querySelector<HTMLElement>('[data-row="5"]')!;
    const identityPreserved = stableAfter === stable;
    if (!identityPreserved) {
        throw new Error("appendChild did not preserve row identity");
    }
    if (document.activeElement !== focused) {
        throw new Error("focused descendant was lost");
    }
    const afterTop = stableAfter.getBoundingClientRect().top;
    if (Math.abs(afterTop - beforeTop) > 1) {
        throw new Error(
            `semantic waterline moved after prepend: top ${beforeTop} -> ${afterTop}, scroll ${beforeScroll} -> ${host.scrollTop}`,
        );
    }
    if (host.scrollTop <= beforeScroll) {
        throw new Error("prepend did not compensate scrollTop");
    }
    const compensatedBy = host.scrollTop - beforeScroll;

    host.scrollTop = 700;
    host.dispatchEvent(new Event("scroll"));
    await waitFor(
        () => surface.querySelector("[data-infini-gap]") != null,
        "focus-pinned row did not form a discontinuous flow-track gap",
    );
    const focusedAfterWindowShift = document.activeElement === focused;
    if (!focusedAfterWindowShift) {
        throw new Error("flow-track window shift lost the focused pinned row");
    }
    if (!dom.scrollToItem(5, "start")) {
        throw new Error("focus-pinned row was absent from Layout");
    }

    disposeDomHarness(harness);
    return { compensatedBy, focusedAfterWindowShift, identityPreserved };
}
