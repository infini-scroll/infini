/** A provider-owned stable identity. Deleted identities must never be reused. */
export type ItemId = string | number;

/** A direction in content order, independent of the current writing mode. */
export type Direction = "before" | "after";

/** Placement of a jump target inside the unobscured visible viewport. */
export type Alignment = "start" | "center" | "end" | "nearest";

/** Predictive blank region containing the current scroll waterline. */
export type BlankZone = "none" | Direction;

/** Kind of asynchronous provider work currently owned by the controller. */
export type EffectKind = "bootstrap" | "fetch" | "seek";

/** A half-open pixel interval in main-island-local coordinates. */
export interface PixelWindow {
    /** Inclusive start coordinate in CSS pixels. */
    start: number;
    /** Exclusive end coordinate in CSS pixels. */
    end: number;
    /** Non-negative `end - start` in CSS pixels. */
    size: number;
}

/** A contiguous provider slice in canonical content order. */
export interface Page<TItem> {
    /** A contiguous slice in content order. */
    items: readonly TItem[];
    /** Whether no content exists before the first returned item. */
    exhaustedBefore: boolean;
    /** Whether no content exists after the last returned item. */
    exhaustedAfter: boolean;
}

/** Result of translating a predicted relative offset into a bootstrap cursor. */
export interface LocateResult<TCursor, TId extends ItemId> {
    /** Opaque cursor around which the subsequent bootstrap should be performed. */
    cursor: TCursor;
    /** Stable id nearest the predicted landing point, when known. */
    targetId?: TId;
}

/**
 * Supplies ordered content to Infini.
 *
 * @remarks
 * Pages must be contiguous, contain unique stable IDs, and be returned in
 * content order. `AbortSignal` is advisory: correctness must not depend on the
 * transport actually cancelling. See `docs/07-provider-contract.md`.
 */
export interface Provider<TItem, TCursor, TId extends ItemId> {
    /**
     * Creates a new contiguous island near an initial or jump cursor.
     *
     * @param input.cursor - Provider-defined location, or `null` for its default.
     * @param input.targetSize - Desired measured coverage in CSS pixels.
     * @param input.signal - Advisory cancellation signal owned by the effect.
     */
    bootstrap(input: {
        cursor: TCursor | null;
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<TItem>>;
    /**
     * Extends a known boundary in content order.
     *
     * @param input.cursor - Cursor extracted from the current boundary item.
     * @param input.direction - Side to fetch in canonical content order.
     * @param input.targetSize - Desired measured coverage in CSS pixels.
     * @param input.signal - Advisory cancellation signal owned by the effect.
     */
    fetch(input: {
        cursor: TCursor;
        direction: Direction;
        targetSize: number;
        signal: AbortSignal;
    }): Promise<Page<TItem>>;
    /**
     * Resolves an estimated relative item offset for a predictive Blank Zone.
     *
     * @remarks
     * The estimate may be approximate; the following bootstrap establishes exact
     * local geometry. This method is never used for ordinary adjacent fetching.
     */
    locateOffset?(input: {
        /** Known item from which the signed prediction is measured. */
        anchor: TItem;
        /** Estimated relative item count; negative means before. */
        signedItemOffset: number;
        /** Advisory cancellation signal owned by the seek effect. */
        signal: AbortSignal;
    }): Promise<LocateResult<TCursor, TId>>;
}

/** Projects immutable identity and Provider cursor from a business item. */
export interface ItemOps<TItem, TCursor, TId extends ItemId> {
    /** Returns the immutable, never-reused identity of an item. */
    getId(item: TItem): TId;
    /** Returns the opaque provider cursor associated with an item. */
    getCursor(item: TItem): TCursor;
}

/** Mutually exclusive foreground lifecycle state. */
export type Phase =
    /** The controller exists but `start()` has not run. */
    | { status: "dormant" }
    /** The first visible island is being requested or prepared. */
    | { status: "bootstrapping" }
    /** A main island is usable; `empty` means a proven, exhausted empty source. */
    | { status: "ready"; empty: boolean }
    /** A predictive or explicit discontinuous jump is being prepared. */
    | { status: "seeking" }
    | {
          /** The foreground intent is latched until `retry()` is called. */
          status: "failed";
          /** Operation whose current foreground attempt failed. */
          operation: "bootstrap" | "fetch" | "seek";
          /** Relevant content direction for edge fetches and seeks. */
          direction?: Direction;
          /** Normalized failure. Non-Error promise rejections are wrapped. */
          error: Error;
      };

/** One main-island item required by the current layout transaction. */
export interface LayoutItem<TItem, TId extends ItemId> {
    /** Non-zero numeric identity used by the platform-independent core. */
    handle: number;
    /** Provider-owned stable identity. */
    id: TId;
    /** Latest registered business object for this identity. */
    item: TItem;
    /** Zero-based rank inside the current main island. */
    index: number;
    /** Position in the physical scroll surface, including leading Blank Zone. */
    start: number;
    /** Current measured or estimated block extent in CSS pixels. */
    extent: number;
    /** Whether `extent` came from a physical measurement. */
    measured: boolean;
}

/** One row in a hidden bootstrap/seek candidate layout. */
export interface CandidateItem<TItem, TId extends ItemId> {
    /** Non-zero numeric identity used by the core. */
    handle: number;
    /** Provider-owned stable identity. */
    id: TId;
    /** Latest registered business object. */
    item: TItem;
    /** Zero-based rank inside the candidate island. */
    index: number;
    /** Candidate-local start coordinate in CSS pixels. */
    start: number;
    /** Current measured or estimated block extent in CSS pixels. */
    extent: number;
    /** Whether `extent` came from a physical measurement. */
    measured: boolean;
}

/** Candidate that must be hidden-mounted, measured, then committed atomically. */
export interface Candidate<TItem, TId extends ItemId> {
    /** Effect ticket that exclusively owns this candidate. */
    effectId: number;
    /** Rows needed to cover the candidate Layout window. */
    items: readonly CandidateItem<TItem, TId>[];
}

/** Read-only diagnostic summary of a live asynchronous effect. */
export interface EffectSnapshot {
    /** Stable effect ticket. */
    id: number;
    /** Bootstrap, adjacent fetch, or discontinuous seek. */
    kind: EffectKind;
    /** Direction in canonical content order. */
    direction: Direction;
    /** Whether this activation may no longer replace the visible main island. */
    detached: boolean;
}

/**
 * Immutable observable controller state.
 *
 * @remarks
 * A snapshot remains referentially stable until `revision` changes. Pixel
 * positions and arrays must not be cached across revisions.
 */
export interface Snapshot<TItem, TId extends ItemId> {
    /** Monotonic observable-state revision used by subscribers. */
    revision: number;
    /** Foreground lifecycle state. */
    phase: Phase;
    /** Core/DOM transaction revision for `commitLayout()`. */
    layoutRevision: number;
    /** Rows that the DOM must currently reconcile. */
    layoutItems: readonly LayoutItem<TItem, TId>[];
    /** Hidden-measure candidate, or `null` when none awaits preparation. */
    candidate: Candidate<TItem, TId> | null;
    /** Total scroll-surface height, including both Blank Zones, in CSS pixels. */
    surfaceExtent: number;
    /** Physical surface offset at which the main island begins. */
    islandOrigin: number;
    /** Unobscured viewport in main-island-local coordinates. */
    visible: PixelWindow;
    /** Pixel window requested for mounting and measurement. */
    layoutTarget: PixelWindow;
    /** Predictive Blank Zone containing the current waterline, if any. */
    blankZone: BlankZone;
    /** Number of items in the dynamically computed Resident range. */
    residentCount: number;
    /** Optional inclusive stable-id range suitable for external subscriptions. */
    residentRange: { first: TId; last: TId } | null;
    /** Known items before Resident; a non-zero value suppresses before-fetching. */
    bufferBefore: number;
    /** Known items after Resident; a non-zero value suppresses after-fetching. */
    bufferAfter: number;
    /** Number of known items in the current main island. */
    mainLength: number;
    /** Aggregate estimated/measured extent of the current main island. */
    mainExtent: number;
    /**
     * Every currently known main-island item in content order.
     *
     * @remarks This includes Resident and both Buffer regions. Positions remain
     * revision-scoped and the array must not be mutated.
     */
    mainItems: readonly LayoutItem<TItem, TId>[];
    /** Non-zero main-island identity, or `0` before a main island exists. */
    mainIsland: number;
    /** Non-zero before-side Stale island identity, or `0`. */
    staleBeforeIsland: number;
    /** Non-zero after-side Stale island identity, or `0`. */
    staleAfterIsland: number;
    /** Whether the main island proves the before content boundary. */
    exhaustedBefore: boolean;
    /** Whether the main island proves the after content boundary. */
    exhaustedAfter: boolean;
    /** Whether a live effect currently extends the before frontier. */
    loadingBefore: boolean;
    /** Whether a live effect currently extends the after frontier. */
    loadingAfter: boolean;
    /** Diagnostic list of all live asynchronous effects. */
    effects: readonly EffectSnapshot[];
    /** Resolves a live core handle to its latest business item. */
    getItem(handle: number): TItem | undefined;
    /** Resolves a stable ID to its non-zero core handle, when registered. */
    getHandle(id: TId): number | undefined;
}

/** A measured block extent for one registered row. */
export interface Measurement {
    /** Numeric identity of the measured row. */
    handle: number;
    /** Finite positive block extent in CSS pixels. */
    extent: number;
}

/**
 * Hidden-mount hook that measures a candidate before it becomes visible.
 * Returning measurements does not itself commit the candidate.
 */
export type CandidatePreparer<TItem, TId extends ItemId> = (
    candidate: Candidate<TItem, TId>,
) => readonly Measurement[] | Promise<readonly Measurement[]>;

/** Immutable construction contract for {@link InfiniController}. */
export interface ControllerConfig<TItem, TCursor, TId extends ItemId, TTarget> {
    /** Optional diagnostic label. Physical adapters may emit labeled debug events. */
    debug?: string;
    /** Ordered, eventually consistent content source. */
    provider: Provider<TItem, TCursor, TId>;
    /** Stable identity and cursor projection for business items. */
    ops: ItemOps<TItem, TCursor, TId>;
    /** Returns a finite positive initial block-size estimate in CSS pixels. */
    estimateSize(item: TItem): number;
    /** Positive fallback extent used for invalid estimates and blank prediction. */
    defaultItemEstimate: number;
    /** Initial bootstrap or target intent. Read once when the controller starts. */
    initial: {
        /** Opaque initial cursor, or `null` for the Provider default. */
        cursor: TCursor | null;
        /** Optional application target resolved through `targetToCursor`. */
        target?: TTarget;
        /** Target placement; defaults to `"start"`. */
        alignment?: Alignment;
    };
    /** Converts an explicit target into a bootstrap cursor. Required by `jump()`. */
    targetToCursor?: (target: TTarget) => TCursor;
    /** Selects the exact stable target ID from a returned bootstrap page. */
    locateTarget?: (items: readonly TItem[], target: TTarget) => TId | null;
    /** Item-count padding before Layout when computing Resident. Defaults to `0`. */
    residentBefore?: number;
    /** Item-count padding after Layout when computing Resident. Defaults to `0`. */
    residentAfter?: number;
    /** Relevant no-anchor loads before a Stale island is dropped. Defaults to `3`. */
    staleMissLimit?: number;
    /** Pixel overscan; defaults to one current viewport on each side. */
    layoutBefore?: number;
    /** After-side pixel overscan; defaults to one current viewport. */
    layoutAfter?: number;
    /** Receives background edge/predictive failures even when visible content remains usable. */
    onError?: (
        error: Error,
        context: {
            /** Kind of Provider operation that failed. */
            operation: "bootstrap" | "fetch" | "seek";
            /** Direction associated with the effect in content order. */
            direction: Direction;
            /** Whether the failure controls the current foreground phase. */
            foreground: boolean;
        },
    ) => void;
}

export interface ViewInput {
    /** Scroll position relative to the Infini surface start, in CSS pixels. */
    scroll: number;
    /** Physical host viewport extent in CSS pixels. */
    viewport: number;
    /** Fixed-overlay inset at the content start. Previous value is retained if omitted. */
    paddingStart?: number;
    /** Fixed-overlay inset at the content end. Previous value is retained if omitted. */
    paddingEnd?: number;
    /** Before-side pixel overscan; setting it becomes the persistent override. */
    layoutBefore?: number;
    /** After-side pixel overscan; setting it becomes the persistent override. */
    layoutAfter?: number;
}

/** Ordered external insertion adjacent to a known stable anchor. */
export interface ExternalInsert<TItem, TId extends ItemId> {
    /** Stable item next to which the new contiguous items belong. */
    anchor: TId;
    /** Side of the anchor in canonical content order. */
    side: Direction;
    /** New items in canonical content order. */
    items: readonly TItem[];
}
