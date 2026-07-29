import { useState } from "react";

import { InfiniList, useInfini } from "infini-react";

import { RandomItemProvider, type DemoItem } from "./provider.js";

const provider = new RandomItemProvider();

function RandomFeed({ scrollHost }: { scrollHost: HTMLDivElement }) {
    const { controller, snapshot } = useInfini<
        DemoItem,
        number,
        number,
        number
    >({
        debug: import.meta.env.DEV ? "InfiniDemo" : undefined,
        provider,
        ops: {
            getId: (item) => item.id,
            getCursor: (item) => item.id,
        },
        estimateSize: (item) => item.height + 10,
        defaultItemEstimate: 138,
        initial: {
            cursor: null,
            target: 0,
            alignment: "center",
        },
        targetToCursor: (target) => target,
        locateTarget: (items, target) =>
            items.some((item) => item.id === target) ? target : null,
        residentBefore: 12,
        residentAfter: 12,
        layoutBefore: 720,
        layoutAfter: 720,
    });

    return (
        <>
            {snapshot.phase.status === "bootstrapping" ? (
                <div className="notice">Generating the first items…</div>
            ) : null}
            {snapshot.phase.status === "failed" ? (
                <div className="notice notice-error" role="alert">
                    <span>{snapshot.phase.error.message}</span>
                    <button type="button" onClick={controller.retry}>
                        Retry
                    </button>
                </div>
            ) : null}
            <InfiniList
                controller={controller}
                scrollHost={scrollHost}
                layoutBefore={720}
                layoutAfter={720}
                rowClassName="item-shell"
                renderItem={(item) => <DemoCard item={item} />}
            />
        </>
    );
}

function DemoCard({ item }: { item: DemoItem }) {
    return (
        <article
            className="demo-item"
            style={{ backgroundColor: item.color, height: item.height }}
        >
            <span className="item-number">
                {item.id < 0 ? `−${Math.abs(item.id)}` : item.id}
            </span>
            <div>
                <h2>Generated item</h2>
                <p>
                    {item.height}px high · {item.color}
                </p>
            </div>
        </article>
    );
}

export function App() {
    const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);

    return (
        <main className="app-shell">
            <header className="hero">
                <div>
                    <p className="eyebrow">Vite · React · infini-react</p>
                    <h1>An endless field of color.</h1>
                </div>
                <p className="intro">
                    Scroll in either direction. The provider creates softly
                    colored items with random heights, while Infini keeps the
                    mounted DOM small.
                </p>
            </header>

            <section className="demo-panel" aria-label="Infinite list demo">
                <div className="panel-heading">
                    <span>Random provider</span>
                    <span className="live-indicator">
                        <i aria-hidden="true" />
                        live
                    </span>
                </div>
                <div
                    ref={setScrollHost}
                    className="scroll-viewport"
                    tabIndex={0}
                >
                    {scrollHost ? <RandomFeed scrollHost={scrollHost} /> : null}
                </div>
            </section>
        </main>
    );
}
