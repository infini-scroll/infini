use infini_core::{
    Alignment, CommitDisposition, Diagnostics, Direction, EdgeState, Effect, Engine, Handle, Item,
    ItemSnapshot, ViewMetrics, WindowKind,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const TYPESCRIPT_TYPES: &str = r#"
export interface RawItem {
  handle: number;
  extent: number;
  measured?: boolean;
}

export interface RawRow {
  handle: number;
  index: number;
  start: number;
  extent: number;
  measured: boolean;
}

export interface RawEffect {
  id: number;
  kind: RawEffectKind;
  state: RawEffectState;
  owner: number;
  direction: RawDirection;
  anchor: number;
  signedOffset: number;
  targetExtent: number;
  targetToken: number;
}

export interface RawViewMetrics {
  scroll: number;
  viewport: number;
  insetStart: number;
  insetEnd: number;
  layoutBefore: number;
  layoutAfter: number;
}

export interface RawSnapshot {
  main: number;
  staleBefore: number;
  staleAfter: number;
  surfaceExtent: number;
  islandOrigin: number;
  blankBefore: number;
  blankAfter: number;
  blankZone: RawBlankZone;
  visible: Readonly<{ start: number; end: number; size: number }>;
  layoutTarget: Readonly<{ start: number; end: number; size: number }>;
  mainLength: number;
  mainExtent: number;
  residentStart: number;
  residentEnd: number;
  residentCount: number;
  residentFirst: number;
  residentLast: number;
  bufferBefore: number;
  bufferAfter: number;
  layoutRevision: number;
}

export interface RawDiagnostics {
  visited: number;
  touched: number;
  emitted: number;
}

export interface InfiniEngine {
  reset(): void;
  configure(input: {
    residentBefore: number;
    residentAfter: number;
    staleMissLimit?: number;
  }): void;
  setView(view: RawViewMetrics): void;
  beginBootstrap(targetToken?: number): number;
  beginSeek(direction: "before" | "after", targetToken?: number): number;
  takeEffects(): RawEffect[];
  effect(effect: number): RawEffect | null;
  effectAffectsMain(effect: number): boolean;
  detachEffect(effect: number): boolean;
  rejectEffect(effect: number): boolean;
  commitEffect(input: {
    effect: number;
    items: readonly RawItem[];
    exhaustedBefore: boolean;
    exhaustedAfter: boolean;
    targetHandle?: number;
    alignment?: RawAlignment;
  }): RawCommitDisposition;
  commitCandidate(effect: number): boolean;
  candidateIsland(effect: number): number;
  externalInsert(
    anchor: number,
    side: "before" | "after",
    items: readonly RawItem[],
  ): number;
  externalDelete(handles: readonly number[]): number;
  measure(measurements: readonly { handle: number; extent: number }[]): number;
  captureAnchor(ratio: number): number;
  takeScrollCorrection(): number | null;
  pin(handle: number, pinned: boolean): boolean;
  reopen(direction: "before" | "after"): void;
  retryPredictiveSeek(direction: "before" | "after"): void;
  trimBuffer(direction: "before" | "after", maxItems: number): number;
  layoutRows(): RawRow[];
  candidateRows(effect: number): RawRow[];
  islandRows(island: number): RawRow[];
  islandEdge(island: number, direction: "before" | "after"): RawEdge;
  commitLayout(revision: number, handles: readonly number[]): boolean;
  committedHandles(): number[];
  takeReleased(): number[];
  snapshot(): Readonly<RawSnapshot>;
  diagnostics(): RawDiagnostics;
}
"#;

/// Numeric content-order direction used by the generated JavaScript binding.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawDirection {
    /// Toward lower content ranks.
    Before = 0,
    /// Toward higher content ranks.
    After = 1,
}

/// Numeric state of one known island edge.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawEdge {
    /// More content may exist.
    Open = 0,
    /// No content exists beyond this edge.
    Exhausted = 1,
}

/// Predictive blank region containing the current waterline.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawBlankZone {
    /// Continuous-scroll territory.
    None = 0,
    /// A discontinuous before seek is needed.
    Before = 1,
    /// A discontinuous after seek is needed.
    After = 2,
}

/// Kind of asynchronous work emitted by the core.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawEffectKind {
    /// Create the first main island.
    Bootstrap = 0,
    /// Extend a known frontier.
    EdgeFetch = 1,
    /// Establish a discontinuous island.
    Seek = 2,
}

/// Lifecycle state of an asynchronous effect.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawEffectState {
    /// Waiting for provider data.
    Pending = 0,
    /// Detached from the foreground but still reusable.
    Detached = 1,
    /// Waiting for candidate measurement and commit.
    AwaitingCommit = 2,
}

/// How the engine consumed returned provider data.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawCommitDisposition {
    /// The result was invalid.
    Rejected = 0,
    /// The result extended an existing island.
    Applied = 1,
    /// The result requires candidate measurement.
    Candidate = 2,
    /// A detached result was retained as stale.
    StoredStale = 3,
    /// A valid result was no longer useful.
    Dropped = 4,
}

/// Placement of a target item inside the visible viewport.
#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy)]
pub enum RawAlignment {
    /// Align target start to visible start.
    Start = 0,
    /// Align target center to visible center.
    Center = 1,
    /// Align target end to visible end.
    End = 2,
    /// Preserve visibility or use the nearest edge.
    Nearest = 3,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindingItem {
    handle: u32,
    extent: f64,
    #[serde(default)]
    measured: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindingConfig {
    resident_before: u32,
    resident_after: u32,
    stale_miss_limit: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindingView {
    scroll: f64,
    viewport: f64,
    inset_start: f64,
    inset_end: f64,
    layout_before: f64,
    layout_after: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindingCommit {
    effect: u32,
    items: Vec<BindingItem>,
    exhausted_before: bool,
    exhausted_after: bool,
    #[serde(default)]
    target_handle: u32,
    #[serde(default)]
    alignment: u32,
}

#[derive(Deserialize)]
struct BindingMeasurement {
    handle: u32,
    extent: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BindingEffect {
    id: u32,
    kind: u32,
    state: u32,
    owner: u32,
    direction: u32,
    anchor: u32,
    signed_offset: f64,
    target_extent: f64,
    target_token: u32,
}

impl From<Effect> for BindingEffect {
    fn from(effect: Effect) -> Self {
        Self {
            id: effect.id,
            kind: effect.kind as u32,
            state: effect.state as u32,
            owner: effect.owner,
            direction: effect.direction as u32,
            anchor: effect.anchor,
            signed_offset: effect.signed_offset as f64,
            target_extent: effect.target_extent,
            target_token: effect.target_token,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BindingRow {
    handle: u32,
    index: u32,
    start: f64,
    extent: f64,
    measured: bool,
}

impl From<ItemSnapshot> for BindingRow {
    fn from(row: ItemSnapshot) -> Self {
        Self {
            handle: row.handle,
            index: row.index,
            start: row.start,
            extent: row.extent,
            measured: row.measured,
        }
    }
}

#[derive(Serialize)]
struct BindingWindow {
    start: f64,
    end: f64,
    size: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BindingSnapshot {
    main: u32,
    stale_before: u32,
    stale_after: u32,
    surface_extent: f64,
    island_origin: f64,
    blank_before: f64,
    blank_after: f64,
    blank_zone: u32,
    visible: BindingWindow,
    layout_target: BindingWindow,
    main_length: u32,
    main_extent: f64,
    resident_start: u32,
    resident_end: u32,
    resident_count: u32,
    resident_first: u32,
    resident_last: u32,
    buffer_before: u32,
    buffer_after: u32,
    layout_revision: u32,
}

#[derive(Serialize)]
struct BindingDiagnostics {
    visited: u32,
    touched: u32,
    emitted: u32,
}

fn direction(value: &str) -> Option<Direction> {
    match value {
        "before" => Some(Direction::Before),
        "after" => Some(Direction::After),
        _ => None,
    }
}

fn items(input: Vec<BindingItem>, fallback: f64) -> Vec<Item> {
    input
        .into_iter()
        .map(|item| Item::normalized(item.handle, item.extent, item.measured, fallback))
        .collect()
}

fn serialize<T: Serialize>(value: &T) -> JsValue {
    serde_wasm_bindgen::to_value(value).expect("binding output must be serializable")
}

/// JavaScript-facing owner of one platform-independent Infini engine.
#[wasm_bindgen]
pub struct InfiniEngine {
    engine: Engine,
    default_extent: f64,
}

#[wasm_bindgen]
impl InfiniEngine {
    /// Creates an engine with a finite positive fallback item extent.
    #[wasm_bindgen(constructor)]
    pub fn new(default_extent: f64) -> Self {
        Self {
            engine: Engine::new(default_extent),
            default_extent,
        }
    }

    /// Clears all engine-owned state.
    #[wasm_bindgen(skip_typescript)]
    pub fn reset(&mut self) {
        self.engine.reset();
    }

    /// Configures resident padding and stale eviction.
    #[wasm_bindgen(skip_typescript)]
    pub fn configure(&mut self, input: JsValue) -> Result<(), JsValue> {
        let input: BindingConfig = serde_wasm_bindgen::from_value(input)?;
        self.engine
            .set_resident_padding(input.resident_before, input.resident_after);
        if let Some(limit) = input.stale_miss_limit {
            self.engine.set_stale_miss_limit(limit.max(1));
        }
        Ok(())
    }

    /// Submits host-local viewport geometry.
    #[wasm_bindgen(js_name = setView, skip_typescript)]
    pub fn set_view(&mut self, input: JsValue) -> Result<(), JsValue> {
        let input: BindingView = serde_wasm_bindgen::from_value(input)?;
        self.engine.set_view(ViewMetrics {
            scroll: input.scroll,
            viewport: input.viewport,
            inset_start: input.inset_start,
            inset_end: input.inset_end,
            layout_before: input.layout_before,
            layout_after: input.layout_after,
        });
        Ok(())
    }

    /// Starts initial activation.
    #[wasm_bindgen(js_name = beginBootstrap, skip_typescript)]
    pub fn begin_bootstrap(&mut self, target_token: Option<u32>) -> u32 {
        self.engine.begin_bootstrap(target_token.unwrap_or(0))
    }

    /// Starts explicit discontinuous activation.
    #[wasm_bindgen(js_name = beginSeek, skip_typescript)]
    pub fn begin_seek(&mut self, side: &str, target_token: Option<u32>) -> u32 {
        direction(side).map_or(0, |side| {
            self.engine
                .begin_explicit_seek(side, target_token.unwrap_or(0))
        })
    }

    /// Drains newly scheduled effects.
    #[wasm_bindgen(js_name = takeEffects, skip_typescript)]
    pub fn take_effects(&mut self) -> JsValue {
        let mut effects = Vec::new();
        while let Some(effect) = self.engine.pop_effect() {
            effects.push(BindingEffect::from(effect));
        }
        serialize(&effects)
    }

    /// Returns a live effect or `null`.
    #[wasm_bindgen(skip_typescript)]
    pub fn effect(&self, effect: u32) -> JsValue {
        self.engine.effect(effect).map_or(JsValue::NULL, |effect| {
            serialize(&BindingEffect::from(effect))
        })
    }

    /// Reports whether an effect still targets the resolved main island.
    #[wasm_bindgen(js_name = effectAffectsMain, skip_typescript)]
    pub fn effect_affects_main(&self, effect: u32) -> bool {
        self.engine.effect_affects_main(effect)
    }

    /// Detaches a foreground activation effect.
    #[wasm_bindgen(js_name = detachEffect, skip_typescript)]
    pub fn detach_effect(&mut self, effect: u32) -> bool {
        self.engine.detach_effect(effect)
    }

    /// Rejects a live effect.
    #[wasm_bindgen(js_name = rejectEffect, skip_typescript)]
    pub fn reject_effect(&mut self, effect: u32) -> bool {
        self.engine.reject_effect(effect)
    }

    /// Commits one provider result to its owning effect.
    #[wasm_bindgen(js_name = commitEffect, skip_typescript)]
    pub fn commit_effect(&mut self, input: JsValue) -> Result<u32, JsValue> {
        let input: BindingCommit = serde_wasm_bindgen::from_value(input)?;
        let Some(alignment) = Alignment::from_u32(input.alignment) else {
            return Ok(CommitDisposition::Rejected as u32);
        };
        let items = items(input.items, self.default_extent);
        Ok(self.engine.commit_effect_items(
            input.effect,
            &items,
            input.exhausted_before,
            input.exhausted_after,
            input.target_handle,
            alignment,
        ) as u32)
    }

    /// Activates a measured candidate.
    #[wasm_bindgen(js_name = commitCandidate, skip_typescript)]
    pub fn commit_candidate(&mut self, effect: u32) -> bool {
        self.engine.commit_candidate(effect)
    }

    /// Returns the candidate island ID for an effect.
    #[wasm_bindgen(js_name = candidateIsland, skip_typescript)]
    pub fn candidate_island(&self, effect: u32) -> u32 {
        self.engine.candidate_id(effect)
    }

    /// Applies an ordered external insertion.
    #[wasm_bindgen(js_name = externalInsert, skip_typescript)]
    pub fn external_insert(
        &mut self,
        anchor: u32,
        side: &str,
        input: JsValue,
    ) -> Result<u32, JsValue> {
        let input: Vec<BindingItem> = serde_wasm_bindgen::from_value(input)?;
        let Some(side) = direction(side) else {
            return Ok(0);
        };
        Ok(self
            .engine
            .external_insert(anchor, side, &items(input, self.default_extent)))
    }

    /// Applies external deletions.
    #[wasm_bindgen(js_name = externalDelete, skip_typescript)]
    pub fn external_delete(&mut self, input: JsValue) -> Result<u32, JsValue> {
        let handles: Vec<Handle> = serde_wasm_bindgen::from_value(input)?;
        Ok(self.engine.external_delete(&handles))
    }

    /// Batch-updates measured extents.
    #[wasm_bindgen(skip_typescript)]
    pub fn measure(&mut self, input: JsValue) -> Result<u32, JsValue> {
        let measurements: Vec<BindingMeasurement> = serde_wasm_bindgen::from_value(input)?;
        let measurements: Vec<_> = measurements
            .into_iter()
            .map(|measurement| (measurement.handle, measurement.extent))
            .collect();
        Ok(self.engine.measure_batch(&measurements))
    }

    /// Captures a semantic compensation anchor.
    #[wasm_bindgen(js_name = captureAnchor, skip_typescript)]
    pub fn capture_anchor(&mut self, ratio: f64) -> u32 {
        self.engine.capture_anchor(ratio)
    }

    /// Consumes an absolute scroll correction.
    #[wasm_bindgen(js_name = takeScrollCorrection, skip_typescript)]
    pub fn take_scroll_correction(&mut self) -> JsValue {
        self.engine
            .take_scroll_correction()
            .map_or(JsValue::NULL, JsValue::from_f64)
    }

    /// Pins or unpins one row.
    #[wasm_bindgen(skip_typescript)]
    pub fn pin(&mut self, handle: u32, pinned: bool) -> bool {
        self.engine.pin(handle, pinned)
    }

    /// Reopens one edge.
    #[wasm_bindgen(skip_typescript)]
    pub fn reopen(&mut self, side: &str) {
        if let Some(side) = direction(side) {
            self.engine.reopen_edge(side);
        }
    }

    /// Retries a predictive seek.
    #[wasm_bindgen(js_name = retryPredictiveSeek, skip_typescript)]
    pub fn retry_predictive_seek(&mut self, side: &str) {
        if let Some(side) = direction(side) {
            self.engine.retry_predictive_seek(side);
        }
    }

    /// Trims one outer buffer.
    #[wasm_bindgen(js_name = trimBuffer, skip_typescript)]
    pub fn trim_buffer(&mut self, side: &str, max_items: u32) -> u32 {
        direction(side).map_or(0, |side| self.engine.trim_buffer(side, max_items))
    }

    /// Returns rows required by the main layout target.
    #[wasm_bindgen(js_name = layoutRows, skip_typescript)]
    pub fn layout_rows(&mut self) -> JsValue {
        let rows: Vec<_> = self
            .engine
            .query_layout()
            .iter()
            .copied()
            .map(BindingRow::from)
            .collect();
        serialize(&rows)
    }

    /// Returns hidden-measurement rows for one candidate.
    #[wasm_bindgen(js_name = candidateRows, skip_typescript)]
    pub fn candidate_rows(&mut self, effect: u32) -> JsValue {
        let rows: Vec<_> = self
            .engine
            .candidate_rows(effect)
            .iter()
            .copied()
            .map(BindingRow::from)
            .collect();
        serialize(&rows)
    }

    /// Returns all rows in one island.
    #[wasm_bindgen(js_name = islandRows, skip_typescript)]
    pub fn island_rows(&mut self, island: u32) -> JsValue {
        let rows: Vec<_> = self
            .engine
            .island_rows(island)
            .iter()
            .copied()
            .map(BindingRow::from)
            .collect();
        serialize(&rows)
    }

    /// Returns one island edge.
    #[wasm_bindgen(js_name = islandEdge, skip_typescript)]
    pub fn island_edge(&self, island: u32, side: &str) -> u32 {
        direction(side)
            .and_then(|side| self.engine.island_edge(island, side))
            .unwrap_or(EdgeState::Open) as u32
    }

    /// Acknowledges the exact mounted handle set for a layout revision.
    #[wasm_bindgen(js_name = commitLayout, skip_typescript)]
    pub fn commit_layout(&mut self, revision: u32, input: JsValue) -> Result<bool, JsValue> {
        let handles: Vec<Handle> = serde_wasm_bindgen::from_value(input)?;
        Ok(self.engine.commit_layout(revision, &handles))
    }

    /// Returns the most recently acknowledged handle set.
    #[wasm_bindgen(js_name = committedHandles, skip_typescript)]
    pub fn committed_handles(&self) -> JsValue {
        serialize(&self.engine.committed_handles())
    }

    /// Drains handles no longer referenced by engine state.
    #[wasm_bindgen(js_name = takeReleased, skip_typescript)]
    pub fn take_released(&mut self) -> JsValue {
        let mut handles = Vec::new();
        while let Some(handle) = self.engine.pop_released() {
            handles.push(handle);
        }
        serialize(&handles)
    }

    /// Returns a point-in-time topology and geometry snapshot.
    #[wasm_bindgen(skip_typescript)]
    pub fn snapshot(&mut self) -> JsValue {
        let main = self.engine.main_id();
        let visible = self.engine.window(WindowKind::Visible);
        let layout_target = self.engine.window(WindowKind::LayoutTarget);
        let (resident_start, resident_end) = self.engine.resident_bounds();
        let snapshot = BindingSnapshot {
            main,
            stale_before: self.engine.stale_id(Direction::Before),
            stale_after: self.engine.stale_id(Direction::After),
            surface_extent: self.engine.surface_extent(),
            island_origin: self.engine.island_origin(),
            blank_before: self.engine.blank_extent(Direction::Before),
            blank_after: self.engine.blank_extent(Direction::After),
            blank_zone: self.engine.blank_zone() as u32,
            visible: BindingWindow {
                start: visible.start,
                end: visible.end,
                size: visible.extent(),
            },
            layout_target: BindingWindow {
                start: layout_target.start,
                end: layout_target.end,
                size: layout_target.extent(),
            },
            main_length: self.engine.main_len(),
            main_extent: self.engine.main_extent(),
            resident_start,
            resident_end,
            resident_count: self.engine.resident_count(),
            resident_first: self.engine.resident_handle(Direction::Before),
            resident_last: self.engine.resident_handle(Direction::After),
            buffer_before: self.engine.buffer_count(Direction::Before),
            buffer_after: self.engine.buffer_count(Direction::After),
            layout_revision: self.engine.layout_revision(),
        };
        serialize(&snapshot)
    }

    /// Returns cumulative sequence diagnostics.
    #[wasm_bindgen(skip_typescript)]
    pub fn diagnostics(&self) -> JsValue {
        let Diagnostics {
            visited,
            touched,
            emitted,
        } = self.engine.diagnostics();
        serialize(&BindingDiagnostics {
            visited,
            touched,
            emitted,
        })
    }
}
