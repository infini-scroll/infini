import { InfiniController } from "@infini-scroll/core";
import { InfiniDomHost } from "@infini-scroll/dom-support";

import {
    completePage,
    config,
    nextFrame,
    rows,
    waitFor,
    type Row,
} from "./support.js";

export async function run(): Promise<Record<string, unknown>> {
    const host = document.createElement("div");
    const surface = document.createElement("div");
    host.appendChild(surface);
    document.body.appendChild(host);
    Object.assign(host.style, {
        height: "240px",
        overflow: "auto",
    });

    const initialRows = rows(0, 200);
    const endRows = rows(160, 40);
    const controller = new InfiniController<Row, number, number, number>({
        ...config(initialRows),
        provider: {
            bootstrap: async ({ cursor }) =>
                cursor === 199
                    ? {
                          items: endRows,
                          exhaustedBefore: false,
                          exhaustedAfter: true,
                      }
                    : {
                          items: initialRows,
                          exhaustedBefore: false,
                          exhaustedAfter: true,
                      },
            fetch: async () => completePage([]),
        },
        targetToCursor: (target) => target,
        locateTarget: (items, target) =>
            items.some((item) => item.id === target) ? target : null,
        initial: { cursor: null, target: 100, alignment: "center" },
    });
    const dom = new InfiniDomHost({
        controller,
        container: surface,
        scrollHost: host,
        layoutBefore: 120,
        layoutAfter: 120,
        createRow(item) {
            const node = document.createElement("div");
            node.dataset.seekRow = String(item.id);
            node.style.height = `${item.height}px`;
            return node;
        },
    });

    controller.start();
    await waitFor(
        () =>
            controller.getSnapshot().phase.status === "ready" &&
            surface.querySelector('[data-seek-row="100"]') != null,
        "seek fixture did not finish its initial bootstrap",
    );

    let liveTargetRectReads = 0;
    const originalRowRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
        if (
            this.dataset.seekRow === "199" &&
            this.parentElement?.dataset.infiniLiveTrack != null
        ) {
            liveTargetRectReads += 1;
        }
        return originalRowRect.call(this);
    };
    if (dom.scrollToItem(199, "end")) {
        throw new Error("out-of-layout target unexpectedly bypassed seek");
    }
    controller.jump(199, { alignment: "end" });
    try {
        await waitFor(
            () =>
                controller.getSnapshot().phase.status === "ready" &&
                surface.querySelector('[data-seek-row="199"]') != null &&
                liveTargetRectReads > 0,
            "end-target seek did not finish its deferred physical alignment",
        );
        await nextFrame();
    } finally {
        HTMLElement.prototype.getBoundingClientRect = originalRowRect;
    }

    const last = surface.querySelector<HTMLElement>('[data-seek-row="199"]')!;
    const hostRect = host.getBoundingClientRect();
    const viewportBottom = hostRect.top + host.clientTop + host.clientHeight;
    const itemBottom = last.getBoundingClientRect().bottom;
    if (Math.abs(itemBottom - viewportBottom) > 1) {
        throw new Error(
            `end-target seek landed at item bottom ${itemBottom}, expected ${viewportBottom}; scroll=${host.scrollTop}, origin=${controller.getSnapshot().islandOrigin}`,
        );
    }

    dom.dispose();
    controller.dispose();
    host.remove();
    return { itemBottom, liveTargetRectReads, viewportBottom };
}
