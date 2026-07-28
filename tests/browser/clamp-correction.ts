import { type InfiniController } from "infini-core";
import { InfiniDomHost } from "infini-dom-support";

import { type Row } from "./support.js";

export async function run(): Promise<Record<string, unknown>> {
    // A surface shrink may clamp scrollTop between the transaction's initial
    // view read and its correction write. The controller must receive the real
    // browser landing rather than the now-unreachable requested value.
    const host = document.createElement("div");
    const surface = document.createElement("div");
    host.appendChild(surface);
    document.body.appendChild(host);
    Object.assign(host.style, {
        height: "100px",
        overflow: "auto",
    });
    surface.style.height = "1000px";
    host.scrollTop = 800;

    const views: number[] = [];
    let correctionPending = true;
    const snapshot = {
        surfaceExtent: 200,
        candidate: null,
        layoutRevision: 1,
        layoutItems: [],
    };
    const controller = {
        debug: undefined,
        subscribe: () => () => {},
        setCandidatePreparer: () => () => {},
        setView: ({ scroll }: { scroll: number }) => views.push(scroll),
        getSnapshot: () => snapshot,
        commitLayout: () => true,
        takeScrollCorrection: () => {
            if (!correctionPending) return null;
            correctionPending = false;
            return 800;
        },
        captureAnchor: () => 0,
        measure: () => 0,
        pin: () => false,
    } as unknown as InfiniController<Row, number, number>;
    const dom = new InfiniDomHost({
        controller,
        container: surface,
        scrollHost: host,
        createRow() {
            return document.createElement("div");
        },
    });

    dom.flushNow();
    const clampedLanding = host.scrollTop;
    const acknowledgedScroll = views[views.length - 1];
    if (
        Math.abs(clampedLanding - 100) > 1 ||
        acknowledgedScroll !== clampedLanding
    ) {
        throw new Error(
            `clamped correction ACK mismatch: host=${clampedLanding}, ack=${acknowledgedScroll}`,
        );
    }

    dom.dispose();
    host.remove();
    return { acknowledgedScroll, clampedLanding };
}
