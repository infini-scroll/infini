# Infini

## Usage

```sh
pnpm add @infini-scroll/core @infini-scroll/react
```

```tsx
import { initializeInfini } from "@infini-scroll/core";
import { InfiniList, useInfini } from "@infini-scroll/react";

await initializeInfini();
const { controller, snapshot } = useInfini({
    provider: {
        bootstrap: ({ cursor, targetSize, signal }) =>
            api.bootstrap({ cursor, targetSize, signal }),
        fetch: ({ cursor, direction, targetSize, signal }) =>
            api.fetch({ cursor, direction, targetSize, signal }),
        locateOffset: ({ anchor, signedItemOffset, signal }) =>
            api.locateOffset({ anchor, signedItemOffset, signal }),
    },
    ops: {
        getId: (message) => message.id,
        getCursor: (message) => message.cursor,
    },
    estimateSize: () => 72,
    defaultItemEstimate: 72,
    initial: { cursor: null },
    layoutBefore: 800,
    layoutAfter: 800,
    residentBefore: 40,
    residentAfter: 40,
});

return (
    <InfiniList
        controller={controller}
        renderItem={(message) => <Message message={message} />}
    />
);
```

## Build

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
pnpm install
pnpm build
```
