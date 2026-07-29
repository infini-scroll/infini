import {
    InfiniController,
    type ControllerConfig,
    type Page,
} from "@infini-scroll/core";
import { InfiniDomHost } from "@infini-scroll/dom-support";

export interface Row {
    id: number;
    label: string;
    height: number;
}

export interface BrowserResult {
    ok: boolean;
    error?: string;
    details?: Record<string, unknown>;
}

declare global {
    interface Window {
        __infiniResult?: BrowserResult;
    }
}

export const rows = (start: number, count: number, height = 24): Row[] =>
    Array.from({ length: count }, (_, index) => ({
        id: start + index,
        label: `row-${start + index}`,
        height,
    }));

export const completePage = (items: readonly Row[]): Page<Row> => ({
    items,
    exhaustedBefore: true,
    exhaustedAfter: true,
});

export const config = (
    items: readonly Row[],
): ControllerConfig<Row, number, number, never> => ({
    provider: {
        bootstrap: async () => completePage(items),
        fetch: async () => completePage([]),
    },
    ops: {
        getId: (item) => item.id,
        getCursor: (item) => item.id,
    },
    estimateSize: (item) => item.height,
    defaultItemEstimate: 24,
    initial: { cursor: null },
    residentBefore: 3,
    residentAfter: 3,
    layoutBefore: 120,
    layoutAfter: 120,
});

export const nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function waitFor(
    predicate: () => boolean,
    message: string,
): Promise<void> {
    for (let pass = 0; pass < 240; pass += 1) {
        if (predicate()) return;
        await nextFrame();
    }
    throw new Error(message);
}

export interface DomHarness {
    controller: InfiniController<Row, number, number>;
    dom: InfiniDomHost<Row, number, number>;
    host: HTMLDivElement;
    surface: HTMLDivElement;
}

export function createDomHarness(
    items: readonly Row[] = rows(0, 40),
): DomHarness {
    const host = document.createElement("div");
    const surface = document.createElement("div");
    host.appendChild(surface);
    document.body.appendChild(host);
    Object.assign(host.style, {
        height: "240px",
        overflow: "auto",
        border: "3px solid black",
    });

    const controller = new InfiniController(config(items));
    const dom = new InfiniDomHost({
        controller,
        container: surface,
        scrollHost: host,
        layoutBefore: 120,
        layoutAfter: 120,
        createRow(item) {
            const node = document.createElement("div");
            node.dataset.row = String(item.id);
            node.style.height = `${item.height}px`;
            const input = document.createElement("input");
            input.value = item.label;
            node.appendChild(input);
            return node;
        },
        updateRow(node, item) {
            node.style.height = `${item.height}px`;
            const input = node.querySelector("input");
            if (input) input.value = item.label;
        },
    });

    return { controller, dom, host, surface };
}

export async function startDomHarness({
    controller,
    surface,
}: DomHarness): Promise<void> {
    controller.start();
    await waitFor(
        () =>
            controller.getSnapshot().phase.status === "ready" &&
            surface.querySelector("[data-infini-live-track] > [data-row]") !=
                null,
        "DOM bootstrap did not commit",
    );
    await nextFrame();
}

export function disposeDomHarness({ controller, dom, host }: DomHarness): void {
    dom.dispose();
    controller.dispose();
    host.remove();
}
