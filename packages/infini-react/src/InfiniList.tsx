import {
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
    type CSSProperties,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { InfiniController, ItemId } from "@infini-scroll/core";
import { InfiniDomHost, type ScrollHost } from "@infini-scroll/dom-support";

interface PortalSlot<TItem, TId extends ItemId> {
    id: TId;
    item: TItem;
    node: HTMLElement;
    portalKey: number;
    handle: number;
}

class PortalStore<TItem, TId extends ItemId> {
    private readonly slots = new Map<number, PortalSlot<TItem, TId>>();
    private readonly handles = new Map<number, Set<number>>();
    private readonly nodes = new WeakMap<HTMLElement, number>();
    private readonly listeners = new Set<() => void>();
    private version = 0;
    private nextPortalKey = 1;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): number => this.version;

    values(): PortalSlot<TItem, TId>[] {
        return [...this.slots.values()];
    }

    set(slot: PortalSlot<TItem, TId>): void {
        slot.portalKey = this.nextPortalKey++;
        this.slots.set(slot.portalKey, slot);
        this.nodes.set(slot.node, slot.portalKey);
        let portalKeys = this.handles.get(slot.handle);
        if (!portalKeys) {
            portalKeys = new Set();
            this.handles.set(slot.handle, portalKeys);
        }
        portalKeys.add(slot.portalKey);
        this.emit();
    }

    update(handle: number, item: TItem, id: TId): void {
        const portalKeys = this.handles.get(handle);
        if (!portalKeys?.size) return;
        for (const portalKey of portalKeys) {
            const slot = this.slots.get(portalKey);
            if (!slot) continue;
            slot.item = item;
            slot.id = id;
        }
        this.emit();
    }

    deleteNode(node: HTMLElement): void {
        const portalKey = this.nodes.get(node);
        if (portalKey == null) return;
        const slot = this.slots.get(portalKey);
        if (!slot) return;
        const portalKeys = this.handles.get(slot.handle);
        if (portalKeys) {
            portalKeys.delete(portalKey);
            if (!portalKeys.size) this.handles.delete(slot.handle);
        }
        this.slots.delete(portalKey);
        this.emit();
    }

    private emit(): void {
        this.version += 1;
        for (const listener of this.listeners) listener();
    }
}

/** Props for the React portal adapter over {@link InfiniDomHost}. */
export interface InfiniListProps<TItem, TCursor, TId extends ItemId, TTarget> {
    /** Long-lived controller created directly or by `useInfini`. */
    controller: InfiniController<TItem, TCursor, TId, TTarget>;
    /** Renders React content inside a stable DOM row shell. */
    renderItem(item: TItem, id: TId): ReactNode;
    /** Window or overflow element owning scroll. Defaults to `window`. */
    scrollHost?: ScrollHost;
    /** Start-side fixed-overlay inset in CSS pixels. */
    paddingStart?: number;
    /** End-side fixed-overlay inset in CSS pixels. */
    paddingEnd?: number;
    /** Start-side Layout overscan in CSS pixels; defaults to one viewport. */
    layoutBefore?: number;
    /** End-side Layout overscan in CSS pixels; defaults to one viewport. */
    layoutAfter?: number;
    /** Compensation waterline ratio inside VisibleWindow. Defaults to `0`. */
    anchorRatio?: number;
    /** Class applied to the complete scroll-surface container. */
    className?: string;
    /** Style applied to the surface; framework-owned height/position still win. */
    style?: CSSProperties;
    /** Class applied to every stable row shell. */
    rowClassName?: string;
    /** Receives the mounted DOM executor, then `null` during cleanup. */
    onHostChange?: (
        host: InfiniDomHost<TItem, TCursor, TId, TTarget> | null,
    ) => void;
}

/**
 * React portal adapter. The DOM host owns stable row shells and may move them;
 * React owns only each shell's portal contents, preserving component state.
 *
 * @returns A relative scroll-surface container populated through portals.
 * @remarks Keep `controller` stable. Changing host geometry props recreates the
 * DOM executor but preserves the controller and registered data.
 */
export function InfiniList<
    TItem,
    TCursor,
    TId extends ItemId,
    TTarget = never,
>({
    controller,
    renderItem,
    scrollHost,
    paddingStart,
    paddingEnd,
    layoutBefore,
    layoutAfter,
    anchorRatio,
    className,
    style,
    rowClassName,
    onHostChange,
}: InfiniListProps<TItem, TCursor, TId, TTarget>) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const hostRef = useRef<InfiniDomHost<TItem, TCursor, TId, TTarget> | null>(
        null,
    );
    const store = useMemo(() => new PortalStore<TItem, TId>(), []);
    useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const host = new InfiniDomHost<TItem, TCursor, TId, TTarget>({
            controller,
            container,
            scrollHost,
            paddingStart,
            paddingEnd,
            layoutBefore,
            layoutAfter,
            anchorRatio,
            createRow(item, id) {
                const handle = controller.getSnapshot().getHandle(id);
                if (handle == null)
                    throw new Error("Infini portal row has no handle");
                const node = container.ownerDocument.createElement("div");
                node.dataset.infiniHandle = String(handle);
                if (rowClassName) node.className = rowClassName;
                store.set({ handle, id, item, node, portalKey: 0 });
                return node;
            },
            updateRow(_node, item, id) {
                const handle = controller.getSnapshot().getHandle(id);
                if (handle != null) store.update(handle, item, id);
            },
            disposeRow(node) {
                store.deleteNode(node);
            },
        });
        hostRef.current = host;
        return () => {
            hostRef.current = null;
            host.dispose();
        };
    }, [
        anchorRatio,
        controller,
        paddingEnd,
        paddingStart,
        layoutAfter,
        layoutBefore,
        rowClassName,
        scrollHost,
        store,
    ]);

    useLayoutEffect(() => {
        onHostChange?.(hostRef.current);
        return () => {
            onHostChange?.(null);
        };
    }, [onHostChange]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: "100%", ...style }}
        >
            {store
                .values()
                .map((slot) =>
                    createPortal(
                        renderItem(slot.item, slot.id),
                        slot.node,
                        slot.portalKey,
                    ),
                )}
        </div>
    );
}
