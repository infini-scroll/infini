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
    const spacer = document.createElement("div");
    spacer.style.height = "400px";
    const surface = document.createElement("div");
    const footer = document.createElement("div");
    footer.style.height = "80px";
    document.body.append(spacer, surface, footer);

    const initialRows = rows(200, 30, 32);
    const endRows = rows(300, 40, 32);
    const controller = new InfiniController<Row, number, number, number>({
        ...config(initialRows),
        provider: {
            bootstrap: async ({ cursor }) =>
                cursor === 339
                    ? {
                          items: endRows,
                          exhaustedBefore: false,
                          exhaustedAfter: true,
                      }
                    : completePage(initialRows),
            fetch: async () => completePage([]),
        },
        targetToCursor: (target) => target,
        locateTarget: (items, target) =>
            items.some((item) => item.id === target) ? target : null,
    });
    const dom = new InfiniDomHost({
        controller,
        container: surface,
        paddingEnd: 80,
        createRow(item) {
            const node = document.createElement("div");
            node.dataset.windowRow = String(item.id);
            node.style.height = `${item.height}px`;
            return node;
        },
    });

    controller.start();
    await waitFor(
        () =>
            controller.getSnapshot().phase.status === "ready" &&
            surface.querySelector("[data-window-row]") != null &&
            window.scrollY > 0,
        "window scroll host did not commit",
    );
    const surfaceOffset = surface.getBoundingClientRect().top + window.scrollY;
    if (Math.abs(window.scrollY - surfaceOffset) > 1) {
        throw new Error(
            `window scroll host did not apply local target coordinates: scroll=${window.scrollY}, surface=${surfaceOffset}`,
        );
    }
    if (dom.scrollToItem(339, "end")) {
        throw new Error("window target unexpectedly bypassed seek");
    }
    controller.jump(339, { alignment: "end" });
    await waitFor(
        () =>
            controller.getSnapshot().phase.status === "ready" &&
            surface.querySelector('[data-window-row="339"]') != null,
        "window end-target seek did not activate",
    );
    await nextFrame();

    const last = surface.querySelector<HTMLElement>('[data-window-row="339"]')!;
    const expectedLastBottom = window.innerHeight - 80;
    const lastBottom = last.getBoundingClientRect().bottom;
    if (Math.abs(lastBottom - expectedLastBottom) > 1) {
        throw new Error(
            `window end-target seek landed at ${lastBottom}, expected ${expectedLastBottom}`,
        );
    }

    dom.dispose();
    controller.dispose();
    spacer.remove();
    surface.remove();
    footer.remove();
    return { expectedLastBottom, lastBottom, surfaceOffset };
}
