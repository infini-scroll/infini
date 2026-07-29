import { InfiniController } from "infini-core";
import { InfiniDomHost } from "infini-dom-support";

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

    const runwayRows = rows(300, 40);
    const controller = new InfiniController<Row, number, number, never>({
        ...config(runwayRows),
        provider: {
            bootstrap: async () => ({
                items: runwayRows,
                exhaustedBefore: false,
                exhaustedAfter: true,
            }),
            fetch: async () => completePage([]),
        },
        initial: { cursor: null, alignment: "end" },
    });
    const dom = new InfiniDomHost({
        controller,
        container: surface,
        scrollHost: host,
        layoutBefore: 120,
        layoutAfter: 120,
        createRow(item) {
            const node = document.createElement("div");
            node.dataset.runwayRow = String(item.id);
            node.style.height = `${item.height}px`;
            return node;
        },
    });

    controller.start();
    await waitFor(
        () =>
            controller.getSnapshot().phase.status === "ready" &&
            surface.querySelector('[data-runway-row="339"]') != null,
        "open-before runway did not bootstrap at Content End",
    );
    if (!dom.scrollToItem(339, "end")) {
        throw new Error("open-before last item rejected end scroll");
    }
    await nextFrame();

    const snapshot = controller.getSnapshot();
    const expectedRunwayBottom = snapshot.surfaceExtent - host.clientHeight;
    if (Math.abs(host.scrollTop - expectedRunwayBottom) > 1) {
        throw new Error(
            `open-before end scroll landed at ${host.scrollTop}, expected ${expectedRunwayBottom}, origin ${snapshot.islandOrigin}`,
        );
    }

    const last = surface.querySelector<HTMLElement>('[data-runway-row="339"]')!;
    last.style.height = "224px";
    if (!dom.scrollToItem(339, "end")) {
        throw new Error("dynamically resized last item rejected end scroll");
    }
    const hostRect = host.getBoundingClientRect();
    const viewportBottom = hostRect.top + host.clientTop + host.clientHeight;
    const itemBottom = last.getBoundingClientRect().bottom;
    if (Math.abs(itemBottom - viewportBottom) > 1) {
        throw new Error(
            `end scroll used stale core extent: item bottom ${itemBottom}, viewport bottom ${viewportBottom}`,
        );
    }

    const runwayOrigin = snapshot.islandOrigin;
    dom.dispose();
    controller.dispose();
    host.remove();
    return { itemBottom, runwayOrigin, viewportBottom };
}
