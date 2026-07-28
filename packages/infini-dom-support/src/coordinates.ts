/** Browser window or overflow element that owns the physical scroll position. */
export type ScrollHost = Window | HTMLElement;

/** Host geometry translated into Infini surface-local coordinates. */
export interface HostMetrics {
    /** Scroll position relative to the Infini surface start. */
    localScroll: number;
    /** Infini surface start in the host's scroll coordinate space. */
    surfaceOffset: number;
    /** Physical host viewport block extent in CSS pixels. */
    viewport: number;
}

/**
 * Measures a window or element scroll host relative to an Infini surface.
 *
 * @remarks Element-host coordinates subtract `clientTop`, because the border is
 * outside scroll content coordinates. The surface must belong to a live document.
 * @throws If the surface has no owning window.
 */
export function measureHost(
    host: ScrollHost,
    surface: HTMLElement,
): HostMetrics {
    const ownerWindow = surface.ownerDocument.defaultView;
    if (!ownerWindow) throw new Error("Infini requires a live document");
    if (host === ownerWindow) {
        const scroll = ownerWindow.scrollY;
        const surfaceOffset = surface.getBoundingClientRect().top + scroll;
        return {
            localScroll: scroll - surfaceOffset,
            surfaceOffset,
            viewport: ownerWindow.innerHeight,
        };
    }
    const element = host as HTMLElement;
    const hostRect = element.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const surfaceOffset = surfaceRect.top - hostRect.top + element.scrollTop;
    const contentOffset = surfaceOffset - element.clientTop;
    return {
        localScroll: element.scrollTop - contentOffset,
        surfaceOffset: contentOffset,
        viewport: element.clientHeight,
    };
}

/**
 * Instantly writes an absolute surface-local target to a physical scroll host.
 *
 * @param surfaceOffset - Current surface start in host scroll coordinates.
 * @param localScroll - Desired scroll relative to that surface start.
 */
export function scrollHostTo(
    host: ScrollHost,
    surfaceOffset: number,
    localScroll: number,
): void {
    const target = surfaceOffset + localScroll;
    if ("scrollTo" in host) {
        if (host instanceof Window) {
            host.scrollTo({ top: target, behavior: "instant" });
        } else {
            host.scrollTo({ top: target, behavior: "instant" });
        }
    }
}
