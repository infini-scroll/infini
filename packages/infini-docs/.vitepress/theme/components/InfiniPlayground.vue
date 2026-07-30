<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    useId,
} from "vue";
import * as React from "react";
import * as ReactDomClient from "react-dom/client";
import * as InfiniCore from "@infini-scroll/core";
import * as InfiniDomSupport from "@infini-scroll/dom-support";
import * as InfiniReact from "@infini-scroll/react";
import { playgrounds } from "../../sources";
import type * as Monaco from "monaco-editor";

type PlaygroundName = (typeof playgrounds)[number]["name"];

function getPlayground(name: PlaygroundName) {
    const playground = playgrounds.find((candidate) => candidate.name === name);
    if (!playground) {
        throw new Error(`Missing "${name}" playground configuration.`);
    }
    return playground;
}

const initialPlayground =
    playgrounds.find((playground) => playground.default) ?? playgrounds[0];
const initialSources = Object.fromEntries(
    playgrounds.map((playground) => [playground.name, playground.source]),
) as Record<PlaygroundName, string>;

const CORE_DECLARATIONS = import.meta.glob<string>(
    "../../../../infini-core/dist/**/*.d.ts",
    { eager: true, import: "default", query: "?raw" },
);
const DOM_DECLARATIONS = import.meta.glob<string>(
    "../../../../infini-dom-support/dist/**/*.d.ts",
    { eager: true, import: "default", query: "?raw" },
);
const REACT_DECLARATIONS = import.meta.glob<string>(
    "../../../../infini-react/dist/**/*.d.ts",
    { eager: true, import: "default", query: "?raw" },
);
const LIB_REACT_DECLARATIONS = import.meta.glob<string>(
    "../../../node_modules/@types/react/**/*.d.ts",
    {
        eager: true,
        import: "default",
        query: "?raw",
    },
);
const LIB_REACT_DOM_DECLARATIONS = import.meta.glob<string>(
    "../../../node_modules/@types/react-dom/**/*.d.ts",
    { eager: true, import: "default", query: "?raw" },
);
const PLAYGROUND_TYPES = `
type PlaygroundContext = {
  surface: HTMLElement;
  viewport: HTMLElement;
  report(message: string): void;
};
`;

defineProps<{ inline?: boolean; borderless?: boolean }>();

interface PlaygroundModule {
    mount?: (context: {
        surface: HTMLElement;
        viewport: HTMLElement;
        report(message: string): void;
    }) => void | (() => void) | Promise<void | (() => void)>;
}

const selectedName = ref<PlaygroundName>(initialPlayground.name);
const selectedPlayground = computed(() => getPlayground(selectedName.value));
const sources = reactive<Record<PlaygroundName, string>>(initialSources);
const code = computed({
    get: () => sources[selectedName.value],
    set: (value: string) => {
        sources[selectedName.value] = value;
    },
});
const status = ref("Preparing editor…");
const running = ref(false);
const editorId = useId();
const editorElement = ref<HTMLElement | null>(null);
const playground = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const surface = ref<HTMLElement | null>(null);
const stacked = ref(false);
const codeDrawerOpen = ref(true);
let disposeDemo: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let editorModels: Map<PlaygroundName, Monaco.editor.ITextModel> | null = null;
let typeLibraries: Array<{ dispose(): void }> = [];

function registerPackageTypes(
    monaco: typeof import("monaco-editor"),
    packageName: string,
    declarations: Record<string, string>,
) {
    for (const [fileName, contents] of Object.entries(declarations)) {
        const relativeName =
            fileName.split("/dist/")[1] ||
            fileName.split(`/${packageName}/`)[1];
        typeLibraries.push(
            monaco.typescript.typescriptDefaults.addExtraLib(
                contents,
                `file:///node_modules/${packageName}/${relativeName}`,
            ),
        );
    }
}

function updateLayout(width: number) {
    const nextStacked = width <= 760;
    if (nextStacked === stacked.value) return;
    stacked.value = nextStacked;
    codeDrawerOpen.value = !nextStacked;
}

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
    const playground = selectedPlayground.value;
    sources[playground.name] = playground.source;
    editorModels?.get(playground.name)?.setValue(playground.source);
    void run();
}

async function selectPlayground(name: PlaygroundName) {
    if (name === selectedName.value || running.value) return;
    selectedName.value = name;
    await nextTick();
    if (editor && editorModels) {
        editor.setModel(editorModels.get(name) ?? null);
        editor.updateOptions({
            ariaLabel: `Editable ${selectedPlayground.value.label} demo`,
        });
        editor.focus();
    }
    await run();
}

async function mountEditor() {
    if (!editorElement.value) return;

    const [monaco, editorWorkerModule, tsWorkerModule] = await Promise.all([
        import("monaco-editor"),
        import("monaco-editor/editor/editor.worker.js?worker"),
        import("monaco-editor/language/typescript/ts.worker.js?worker"),
    ]);
    const EditorWorker = editorWorkerModule.default;
    const TypeScriptWorker = tsWorkerModule.default;
    Object.assign(globalThis, {
        MonacoEnvironment: {
            getWorker(_moduleId: string, label: string) {
                return label === "typescript" || label === "javascript"
                    ? new TypeScriptWorker()
                    : new EditorWorker();
            },
        },
    });

    monaco.typescript.typescriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        baseUrl: "/",
        jsx: monaco.typescript.JsxEmit.React,
        lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
        module: monaco.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        paths: {
            "@infini-scroll/core": [
                "node_modules/@infini-scroll/core/index.d.ts",
            ],
            "@infini-scroll/dom-support": [
                "node_modules/@infini-scroll/dom-support/index.d.ts",
            ],
            "@infini-scroll/react": [
                "node_modules/@infini-scroll/react/index.d.ts",
            ],
            react: ["node_modules/@types/react/index.d.ts"],
            "react-dom": ["node_modules/@types/react-dom/index.d.ts"],
        },
        target: monaco.typescript.ScriptTarget.ESNext,
    });
    registerPackageTypes(monaco, "@infini-scroll/core", CORE_DECLARATIONS);
    registerPackageTypes(
        monaco,
        "@infini-scroll/dom-support",
        DOM_DECLARATIONS,
    );
    registerPackageTypes(monaco, "@infini-scroll/react", REACT_DECLARATIONS);
    registerPackageTypes(monaco, "react", LIB_REACT_DECLARATIONS);
    registerPackageTypes(monaco, "react-dom", LIB_REACT_DOM_DECLARATIONS);
    typeLibraries.push(
        monaco.typescript.typescriptDefaults.addExtraLib(
            PLAYGROUND_TYPES,
            "file:///node_modules/@types/playground/index.d.ts",
        ),
    );
    editorModels = new Map(
        playgrounds.map((playground) => [
            playground.name,
            monaco.editor.createModel(
                sources[playground.name],
                playground.language,
                monaco.Uri.parse(`file:///${playground.fileName}`),
            ),
        ]),
    );

    const syncTheme = () => {
        monaco.editor.setTheme(
            document.documentElement.classList.contains("dark")
                ? "vs-dark"
                : "vs",
        );
    };
    editor = monaco.editor.create(editorElement.value, {
        model: editorModels.get(selectedName.value),
        ariaLabel: `Editable ${selectedPlayground.value.label} demo`,
        automaticLayout: true,
        fontSize: 12,
        lineHeight: 20,
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        tabSize: 2,
        theme: document.documentElement.classList.contains("dark")
            ? "vs-dark"
            : "vs",
    });
    editor.onDidChangeModelContent(() => {
        const model = editor?.getModel();
        if (!model || !editorModels) return;
        for (const [name, candidate] of editorModels) {
            if (model === candidate) {
                sources[name] = model.getValue();
                break;
            }
        }
    });
    editor.addAction({
        id: "run-playground",
        label: "Run Playground",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run,
    });
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
}

async function run() {
    if (!surface.value || !viewport.value || running.value) return;
    running.value = true;
    status.value = `Compiling ${selectedPlayground.value.label}…`;

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
                jsx: ts.JsxEmit.React,
            },
            fileName: selectedPlayground.value.fileName,
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
            "@infini-scroll/react": InfiniReact,
            react: React,
            "react-dom/client": ReactDomClient,
        };
        const requireBuiltIn = (name: string) => {
            if (name in builtIns) return builtIns[name];
            throw new Error(
                `Cannot import "${name}". This playground only provides React and @infini-scroll/* libraries.`,
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
    if (playground.value) {
        updateLayout(playground.value.getBoundingClientRect().width);
        resizeObserver = new ResizeObserver(([entry]) => {
            updateLayout(entry.contentRect.width);
        });
        resizeObserver.observe(playground.value);
    }
    await nextTick();
    await mountEditor();
    await run();
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    themeObserver?.disconnect();
    themeObserver = null;
    editor?.dispose();
    editor = null;
    for (const model of editorModels?.values() ?? []) model.dispose();
    editorModels = null;
    for (const library of typeLibraries) library.dispose();
    typeLibraries = [];
    disposeDemo?.();
    disposeDemo = null;
});
</script>

<template>
    <section
        ref="playground"
        class="code-playground"
        :class="{
            'is-inline': inline,
            'is-borderless': borderless,
            'is-code-drawer-open': codeDrawerOpen,
        }"
        aria-label="Editable Infini playground"
    >
        <header class="code-playground-toolbar">
            <div class="code-playground-heading">
                <strong>Playground</strong>
                <div class="mode-picker" aria-label="Rendering adapter">
                    <button
                        v-for="playgroundOption in playgrounds"
                        :key="playgroundOption.name"
                        type="button"
                        class="mode-button"
                        :class="{
                            active: selectedName === playgroundOption.name,
                        }"
                        :aria-pressed="selectedName === playgroundOption.name"
                        :disabled="running"
                        @click="selectPlayground(playgroundOption.name)"
                    >
                        {{ playgroundOption.label }}
                    </button>
                </div>
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
                <div class="pane-label">
                    <span>{{ selectedPlayground.fileName }}</span>
                    <button
                        type="button"
                        class="drawer-toggle"
                        :aria-expanded="codeDrawerOpen"
                        :aria-controls="editorId"
                        @click="codeDrawerOpen = !codeDrawerOpen"
                    >
                        {{ codeDrawerOpen ? "Hide code" : "Show code" }}
                    </button>
                </div>
                <div
                    :id="editorId"
                    ref="editorElement"
                    class="monaco-host"
                    :inert="stacked && !codeDrawerOpen"
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
    </section>
</template>

<style scoped>
.code-playground {
    --play-bg: #fff;
    --play-row-bg: #f7f7f8;
    --play-border: #dedee3;
    --play-text: #25252a;
    --play-muted: #686870;
    container-type: inline-size;
    overflow: hidden;
    margin: 28px 0;
    border: 1px solid var(--vp-c-divider);
    border-radius: 16px;
    background: var(--vp-c-bg);
    box-shadow: 0 18px 48px rgb(33 27 62 / 8%);
}

.code-playground.is-borderless {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
}

:global(.dark) .code-playground {
    --play-bg: #1b1b1f;
    --play-row-bg: #242429;
    --play-border: #3b3b42;
    --play-text: #ededf0;
    --play-muted: #a6a6af;
}

.code-playground-toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    min-height: 58px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--vp-c-divider);
}

.code-playground-heading,
.mode-picker,
.code-playground-actions {
    display: flex;
    align-items: center;
}

.code-playground-heading {
    gap: 14px;
}

.mode-picker {
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 9px;
    background: var(--vp-c-bg-soft);
}

.code-playground-actions {
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

.code-playground button.mode-button {
    padding: 5px 9px;
    background: transparent;
    color: var(--vp-c-text-2);
}

.code-playground button.mode-button.active {
    background: var(--vp-c-bg);
    box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
    color: var(--vp-c-brand-1);
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
    grid-template-columns: minmax(0, 1.12fr) minmax(300px, 0.88fr);
    height: min(72vh, 680px);
    min-height: 500px;
}

.is-borderless .code-playground-grid {
    height: 100%;
    min-height: 0;
}

.code-playground-editor,
.code-playground-preview {
    position: relative;
    display: grid;
    grid-template-rows: 38px minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
}

.code-playground-editor {
    border-right: 1px solid var(--vp-c-divider);
}

.drawer-toggle {
    display: none;
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

.monaco-host {
    width: 100%;
    height: 100%;
    min-height: 0;
}

.play-viewport {
    position: relative;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--play-bg);
    scrollbar-color: #aaa4bf transparent;
    scrollbar-width: thin;
}

.play-viewport:focus-visible {
    outline: 3px solid var(--vp-c-brand-1);
    outline-offset: -3px;
}

:deep(.message-shell) {
    width: 100%;
    padding: 5px 12px;
    box-sizing: border-box;
}

:deep(.message-row) {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--play-border);
    border-radius: 8px;
    background: var(--play-row-bg);
    color: var(--play-text);
    font-size: 0.78rem;
    line-height: 1.45;
}

:deep(.message-row header) {
    display: flex;
    gap: 8px;
    align-items: baseline;
}

:deep(.message-row time) {
    color: var(--play-muted);
    font-size: 0.7rem;
}

:deep(.message-id) {
    color: var(--play-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
}

:deep(.message-row p) {
    margin: 5px 0 0;
}

:deep(.message-row blockquote) {
    margin: 0 0 8px;
    padding: 5px 8px;
    overflow: hidden;
    border-left: 2px solid var(--vp-c-brand-1);
    background: var(--play-bg);
    color: var(--play-muted);
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.reply-link) {
    width: 100%;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 500;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.reply-link:hover) {
    text-decoration: underline;
}

:deep(.unread-divider) {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 3px 0 8px;
    color: var(--vp-c-brand-1);
    font-size: 0.68rem;
    font-weight: 700;
}

:deep(.unread-divider)::before,
:deep(.unread-divider)::after {
    height: 1px;
    flex: 1;
    background: var(--vp-c-brand-1);
    content: "";
}

:deep(.go-to-bottom) {
    position: absolute;
    z-index: 3;
    right: 16px;
    bottom: 16px;
    border: 1px solid var(--play-border);
    background: var(--play-bg);
    box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
    color: var(--play-text);
}

:deep(.play-message) {
    position: absolute;
    z-index: 2;
    top: 12px;
    left: 12px;
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--play-border);
    border-radius: 6px;
    background: var(--play-bg);
    color: var(--play-text);
}

@container (max-width: 760px) {
    .code-playground-grid {
        position: relative;
        grid-template-columns: 1fr;
        grid-template-rows: 38px clamp(430px, 62vh, 560px);
        height: auto;
    }

    .is-borderless .code-playground-grid {
        grid-template-rows: 38px minmax(0, 1fr);
        height: 100%;
    }

    .code-playground-editor {
        position: absolute;
        z-index: 2;
        top: 0;
        right: 0;
        left: 0;
        height: 38px;
        overflow: hidden;
        border-right: 0;
        border-bottom: 1px solid var(--vp-c-divider);
        background: var(--vp-c-bg);
        transition:
            height 180ms ease,
            box-shadow 180ms ease;
    }

    .is-code-drawer-open .code-playground-editor {
        height: clamp(360px, 55vh, 500px);
        box-shadow: 0 18px 36px rgb(33 27 62 / 18%);
    }

    .code-playground-preview {
        grid-row: 2;
    }

    .drawer-toggle {
        display: inline-flex;
        padding: 3px 8px;
        border: 1px solid var(--vp-c-divider);
        background: var(--vp-c-bg);
        color: var(--vp-c-text-2);
        font-size: 0.68rem;
    }
}

@media (max-width: 560px) {
    .code-playground-toolbar,
    .code-playground-heading {
        align-items: flex-start;
        flex-direction: column;
    }

    .code-playground-grid {
        margin-inline: -1px;
    }
}
</style>
