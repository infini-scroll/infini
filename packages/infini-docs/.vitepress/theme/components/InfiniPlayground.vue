<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import * as InfiniCore from "@infini-scroll/core";
import * as InfiniDomSupport from "@infini-scroll/dom-support";

const STARTER_CODE = `import {
  InfiniController,
  initializeInfini,
  type Direction,
  type Page,
  type Provider,
} from "@infini-scroll/core";
import { InfiniDomHost } from "@infini-scroll/dom-support";

type Item = {
  id: number;
  title: string;
  body: string;
  estimatedHeight: number;
};

type PlaygroundContext = {
  surface: HTMLElement;
  viewport: HTMLElement;
  report(message: string): void;
};

const FIRST_ID = -2000;
const LAST_ID = 2000;

function itemAt(id: number): Item {
  const lines = Math.abs((id * 13 + 5) % 4);
  return {
    id,
    title: \`Record \${id}\`,
    body:
      lines === 0
        ? "A compact row."
        : "Variable-height content is measured after rendering. ".repeat(lines),
    estimatedHeight: 68 + lines * 22,
  };
}

function around(center: number, targetSize: number): Page<Item> {
  const current = Math.max(FIRST_ID, Math.min(LAST_ID, Math.round(center)));
  const ids = [current];
  let extent = itemAt(current).estimatedHeight;
  let distance = 1;

  while (extent < Math.max(1200, targetSize)) {
    if (current - distance >= FIRST_ID) {
      ids.unshift(current - distance);
      extent += itemAt(current - distance).estimatedHeight;
    }
    if (current + distance <= LAST_ID) {
      ids.push(current + distance);
      extent += itemAt(current + distance).estimatedHeight;
    }
    if (
      current - distance < FIRST_ID &&
      current + distance > LAST_ID
    ) break;
    distance += 1;
  }

  return {
    items: ids.map(itemAt),
    exhaustedBefore: ids[0] === FIRST_ID,
    exhaustedAfter: ids[ids.length - 1] === LAST_ID,
  };
}

function fromEdge(
  cursor: number,
  direction: Direction,
  targetSize: number,
): Page<Item> {
  const ids = [cursor];
  const step = direction === "before" ? -1 : 1;
  let next = cursor + step;
  let extent = itemAt(cursor).estimatedHeight;

  while (
    extent < Math.max(1200, targetSize) &&
    next >= FIRST_ID &&
    next <= LAST_ID
  ) {
    direction === "before" ? ids.unshift(next) : ids.push(next);
    extent += itemAt(next).estimatedHeight;
    next += step;
  }

  return {
    items: ids.map(itemAt),
    exhaustedBefore: ids[0] === FIRST_ID,
    exhaustedAfter: ids[ids.length - 1] === LAST_ID,
  };
}

const provider: Provider<Item, number, number> = {
  async bootstrap({ cursor, targetSize, signal }) {
    signal.throwIfAborted();
    return around(cursor ?? 0, targetSize);
  },

  async fetch({ cursor, direction, targetSize, signal }) {
    signal.throwIfAborted();
    return fromEdge(cursor, direction, targetSize);
  },

  async locateOffset({ anchor, signedItemOffset, signal }) {
    signal.throwIfAborted();
    const targetId = Math.max(
      FIRST_ID,
      Math.min(LAST_ID, anchor.id + Math.trunc(signedItemOffset)),
    );
    return { cursor: targetId, targetId };
  },
};

export async function mount({
  surface,
  viewport,
  report,
}: PlaygroundContext) {
  await initializeInfini();

  const controller = new InfiniController<Item, number, number>({
    provider,
    ops: {
      getId: (item) => item.id,
      getCursor: (item) => item.id,
    },
    estimateSize: (item) => item.estimatedHeight,
    defaultItemEstimate: 92,
    initial: { cursor: 0 },
    residentBefore: 16,
    residentAfter: 16,
  });

  const host = new InfiniDomHost({
    controller,
    container: surface,
    scrollHost: viewport,

    createRow(item) {
      const row = document.createElement("article");
      row.className = "play-row";
      row.innerHTML =
        \`<strong>\${item.title}</strong><span>\${item.body}</span>\`;
      return row;
    },
  });

  const unsubscribe = controller.subscribe(() => {
    const state = controller.getSnapshot();
    report(
      \`\${state.phase.status} · \${state.layoutItems.length} mounted · \` +
      \`\${state.mainLength} known\`,
    );
  });

  controller.start();

  return () => {
    unsubscribe();
    host.dispose();
    controller.dispose();
  };
}
`;

interface PlaygroundModule {
    mount?: (context: {
        surface: HTMLElement;
        viewport: HTMLElement;
        report(message: string): void;
    }) => void | (() => void) | Promise<void | (() => void)>;
}

const code = ref(STARTER_CODE);
const status = ref("Preparing editor…");
const running = ref(false);
const viewport = ref<HTMLElement | null>(null);
const surface = ref<HTMLElement | null>(null);
let disposeDemo: (() => void) | null = null;

function diagnosticText(
    ts: typeof import("typescript"),
    diagnostic: import("typescript").Diagnostic,
) {
    const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
    );
    if (!diagnostic.file || diagnostic.start == null) return message;
    const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
    );
    return `${position.line + 1}:${position.character + 1} ${message}`;
}

function reset() {
    code.value = STARTER_CODE;
    void run();
}

async function run() {
    if (!surface.value || !viewport.value || running.value) return;
    running.value = true;
    status.value = "Compiling TypeScript…";

    try {
        disposeDemo?.();
        disposeDemo = null;
        surface.value.replaceChildren();
        viewport.value.scrollTop = 0;

        const ts = await import("typescript");
        const result = ts.transpileModule(code.value, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                esModuleInterop: true,
            },
            fileName: "playground.ts",
            reportDiagnostics: true,
        });

        const errors = (result.diagnostics ?? []).filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
        );
        if (errors.length) {
            throw new Error(
                errors.map((error) => diagnosticText(ts, error)).join("\n"),
            );
        }

        const module = { exports: {} as PlaygroundModule };
        const builtIns: Record<string, unknown> = {
            "@infini-scroll/core": InfiniCore,
            "@infini-scroll/dom-support": InfiniDomSupport,
        };
        const requireBuiltIn = (name: string) => {
            if (name in builtIns) return builtIns[name];
            throw new Error(
                `Cannot import "${name}". This playground only provides @infini-scroll/* libraries.`,
            );
        };
        const AsyncFunction = Object.getPrototypeOf(
            async function () {},
        ).constructor;
        const execute = new AsyncFunction(
            "require",
            "module",
            "exports",
            `${result.outputText}\n//# sourceURL=infini-playground.js`,
        );
        await execute(requireBuiltIn, module, module.exports);

        if (typeof module.exports.mount !== "function") {
            throw new Error('The demo must export a function named "mount".');
        }

        status.value = "Starting demo…";
        const cleanup = await module.exports.mount({
            surface: surface.value,
            viewport: viewport.value,
            report(message) {
                status.value = message;
            },
        });
        if (typeof cleanup === "function") disposeDemo = cleanup;
    } catch (problem) {
        status.value =
            problem instanceof Error ? problem.message : String(problem);
    } finally {
        running.value = false;
    }
}

onMounted(async () => {
    await nextTick();
    await run();
});

onBeforeUnmount(() => {
    disposeDemo?.();
    disposeDemo = null;
});
</script>

<template>
    <section class="code-playground" aria-label="Editable Infini playground">
        <header class="code-playground-toolbar">
            <div>
                <strong>TypeScript Playground</strong>
                <span>Built-ins: @infini-scroll/*</span>
            </div>
            <div class="code-playground-actions">
                <button type="button" class="secondary" @click="reset">
                    Reset
                </button>
                <button type="button" :disabled="running" @click="run">
                    {{ running ? "Running…" : "Run" }}
                </button>
            </div>
        </header>

        <div class="code-playground-grid">
            <div class="code-playground-editor">
                <div class="pane-label">demo.ts</div>
                <textarea
                    v-model="code"
                    aria-label="Editable TypeScript demo"
                    spellcheck="false"
                    @keydown.ctrl.enter.prevent="run"
                    @keydown.meta.enter.prevent="run"
                />
            </div>

            <div class="code-playground-preview">
                <div class="pane-label">
                    <span>Preview</span>
                    <output>{{ status }}</output>
                </div>
                <div ref="viewport" class="play-viewport" tabindex="0">
                    <div ref="surface" />
                </div>
            </div>
        </div>

        <footer>
            Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to run.
            Compilation is local; imports other than
            <code>@infini-scroll/*</code> are rejected.
        </footer>
    </section>
</template>

<style scoped>
.code-playground {
    overflow: hidden;
    margin: 28px 0;
    border: 1px solid var(--vp-c-divider);
    border-radius: 16px;
    background: var(--vp-c-bg);
    box-shadow: 0 18px 48px rgb(33 27 62 / 8%);
}

.code-playground-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 58px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--vp-c-divider);
}

.code-playground-toolbar > div:first-child {
    display: grid;
    gap: 2px;
}

.code-playground-toolbar span,
.code-playground footer {
    color: var(--vp-c-text-2);
    font-size: 0.72rem;
}

.code-playground-actions {
    display: flex;
    gap: 8px;
}

.code-playground button {
    padding: 7px 13px;
    border: 0;
    border-radius: 7px;
    background: var(--vp-c-brand-1);
    color: white;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
}

.code-playground button.secondary {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
}

.code-playground button:disabled {
    cursor: wait;
    opacity: 0.65;
}

.code-playground-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
    height: min(72vh, 680px);
    min-height: 500px;
}

.code-playground-editor,
.code-playground-preview {
    display: grid;
    grid-template-rows: 38px minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
}

.code-playground-editor {
    border-right: 1px solid var(--vp-c-divider);
}

.pane-label {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    padding: 0 12px;
    border-bottom: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    font:
        700 0.68rem ui-monospace,
        SFMono-Regular,
        Menlo,
        monospace;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.pane-label output {
    overflow: hidden;
    color: var(--vp-c-text-2);
    font-weight: 500;
    text-overflow: ellipsis;
    text-transform: none;
    white-space: nowrap;
}

textarea {
    width: 100%;
    height: 100%;
    padding: 16px;
    resize: none;
    border: 0;
    outline: 0;
    background: #1f2024;
    color: #e4e4e7;
    font:
        12px/1.65 ui-monospace,
        SFMono-Regular,
        Menlo,
        Consolas,
        monospace;
    tab-size: 2;
    white-space: pre;
}

.play-viewport {
    position: relative;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    background:
        linear-gradient(rgb(255 255 255 / 72%), rgb(255 255 255 / 72%)),
        repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 39px,
            rgb(105 85 217 / 7%) 40px
        );
    scrollbar-color: #aaa4bf transparent;
    scrollbar-width: thin;
}

.play-viewport:focus-visible {
    outline: 3px solid var(--vp-c-brand-1);
    outline-offset: -3px;
}

:deep(.play-row) {
    display: grid;
    gap: 5px;
    width: calc(100% - 14px);
    min-height: 58px;
    margin: 5px 7px;
    padding: 13px 16px;
    border: 1px solid rgb(105 85 217 / 18%);
    border-radius: 11px;
    box-sizing: border-box;
    background: #f0edff;
    color: #29263b;
}

:deep(.play-row strong) {
    font-size: 0.85rem;
}

:deep(.play-row span) {
    color: #68637c;
    font-size: 0.75rem;
    line-height: 1.5;
}

.code-playground footer {
    padding: 9px 14px;
    border-top: 1px solid var(--vp-c-divider);
}

.code-playground footer code,
.code-playground kbd {
    font-size: inherit;
}

@media (max-width: 900px) {
    .code-playground-grid {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(430px, 1fr) minmax(420px, 1fr);
        height: auto;
    }

    .code-playground-editor {
        border-right: 0;
        border-bottom: 1px solid var(--vp-c-divider);
    }
}

@media (max-width: 560px) {
    .code-playground-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }

    .code-playground-grid {
        margin-inline: -1px;
    }
}
</style>
