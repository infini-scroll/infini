import type { Direction, Provider, Page } from "@infini-scroll/core";

export interface DemoItem {
    id: number;
    color: string;
    height: number;
}

const DEFAULT_ITEM_HEIGHT = 128;
const MIN_BATCH_HEIGHT = DEFAULT_ITEM_HEIGHT * 12;

/**
 * An unbounded in-memory provider. Random values are cached by stable ID so
 * inclusive edge fetches always return the same logical item.
 */
export class RandomItemProvider implements Provider<DemoItem, number, number> {
    private readonly items = new Map<number, DemoItem>();

    async bootstrap({
        cursor,
        targetSize,
        signal,
    }: {
        cursor: number | null;
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<DemoItem>> {
        signal.throwIfAborted();
        return this.PageAround(cursor ?? 0, targetSize);
    }

    async fetch({
        cursor,
        direction,
        targetSize,
        signal,
    }: {
        cursor: number;
        direction: Direction;
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<DemoItem>> {
        signal.throwIfAborted();
        return this.PageFromEdge(cursor, direction, targetSize);
    }

    async locateOffset({
        anchor,
        signedItemOffset,
        signal,
    }: {
        anchor: DemoItem;
        signedItemOffset: number;
        signal: AbortSignal;
    }): Promise<{ cursor: number; targetId: number }> {
        signal.throwIfAborted();
        const targetId = anchor.id + Math.trunc(signedItemOffset);
        return { cursor: targetId, targetId };
    }

    private PageAround(center: number, targetSize: number): Page<DemoItem> {
        const target = Math.max(targetSize, MIN_BATCH_HEIGHT);
        const centerItem = this.getItem(center);
        const before: DemoItem[] = [];
        const after: DemoItem[] = [];
        let extent = centerItem.height;
        let distance = 1;

        while (extent < target) {
            const beforeItem = this.getItem(center - distance);
            before.push(beforeItem);
            extent += beforeItem.height;

            if (extent < target) {
                const afterItem = this.getItem(center + distance);
                after.push(afterItem);
                extent += afterItem.height;
            }
            distance += 1;
        }

        return {
            items: [...before.reverse(), centerItem, ...after],
            exhaustedBefore: false,
            exhaustedAfter: false,
        };
    }

    private PageFromEdge(
        cursor: number,
        direction: Direction,
        targetSize: number,
    ): Page<DemoItem> {
        const target = Math.max(targetSize, MIN_BATCH_HEIGHT);
        const anchor = this.getItem(cursor);
        const added: DemoItem[] = [];
        const step = direction === "before" ? -1 : 1;
        let extent = anchor.height;
        let nextId = cursor + step;

        while (extent < target) {
            const item = this.getItem(nextId);
            added.push(item);
            extent += item.height;
            nextId += step;
        }

        return {
            items:
                direction === "before"
                    ? [...added.reverse(), anchor]
                    : [anchor, ...added],
            exhaustedBefore: false,
            exhaustedAfter: false,
        };
    }

    private getItem(id: number): DemoItem {
        const cached = this.items.get(id);
        if (cached) return cached;

        const hue = Math.floor(Math.random() * 360);
        const saturation = 62 + Math.floor(Math.random() * 20);
        const lightness = 82 + Math.floor(Math.random() * 9);
        const item = {
            id,
            color: `hsl(${hue} ${saturation}% ${lightness}%)`,
            height: 88 + Math.floor(Math.random() * 137),
        };
        this.items.set(id, item);
        return item;
    }
}
