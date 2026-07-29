import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { type InfiniController } from "infini-core";
import { InfiniList, useInfini } from "infini-react";

import { config, rows, waitFor, type Row } from "./support.js";
import React from "react";

let mountedController: InfiniController<Row, number, number> | undefined;

function ReactList({ scrollHost }: { scrollHost: HTMLElement }) {
    const { controller, snapshot } = useInfini(config(rows(100, 30, 28)));
    useEffect(() => {
        mountedController = controller;
    }, [controller]);
    return (
        <>
            <output id="react-phase">{snapshot.phase.status}</output>
            <InfiniList
                controller={controller}
                scrollHost={scrollHost}
                layoutBefore={100}
                layoutAfter={100}
                rowClassName="react-row"
                renderItem={(item) => (
                    <div
                        style={{ height: item.height }}
                        data-react-id={item.id}
                    >
                        {item.label}
                    </div>
                )}
            />
        </>
    );
}

function ReactHarness() {
    const [host, setHost] = useState<HTMLDivElement | null>(null);
    return (
        <div
            id="react-host"
            ref={setHost}
            style={{ height: 220, overflow: "auto", border: "2px solid black" }}
        >
            {host ? <ReactList scrollHost={host} /> : null}
        </div>
    );
}

export async function run(): Promise<Record<string, unknown>> {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);
    const reactRoot = createRoot(rootElement);
    reactRoot.render(
        <StrictMode>
            <ReactHarness />
        </StrictMode>,
    );
    await waitFor(
        () =>
            document.querySelector("#react-phase")?.textContent === "ready" &&
            document.querySelector("[data-react-id]") != null,
        "React StrictMode integration did not become ready",
    );

    const controller = mountedController;
    if (!controller) {
        throw new Error("useInfini did not expose its mounted controller");
    }
    const reactNode = document.querySelector<HTMLElement>(
        '[data-react-id="100"]',
    )!;
    controller.updateExternal([{ id: 100, label: "updated", height: 28 }]);
    await waitFor(
        () => reactNode.textContent === "updated",
        "portal content did not update",
    );
    const identityPreserved =
        document.querySelector('[data-react-id="100"]') === reactNode;
    if (!identityPreserved) {
        throw new Error("React portal row identity changed during update");
    }

    reactRoot.unmount();
    await Promise.resolve();
    let disposed = false;
    try {
        controller.getSnapshot();
    } catch {
        disposed = true;
    }
    if (!disposed) {
        throw new Error("useInfini did not dispose after real unmount");
    }
    rootElement.remove();

    return { disposed, identityPreserved, updatedText: reactNode.textContent };
}
