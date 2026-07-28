import initializeWasm, { type InitInput } from "./wasm/infini_wasm.js";

/** Sources accepted by the wasm-pack generated Infini initializer. */
export type WasmSource = InitInput;

let initialization: Promise<void> | null = null;

/**
 * Loads and initializes the process-wide wasm-pack module.
 *
 * @param source - Wasm URL, response, bytes, or precompiled module. Omit it to
 * load the generated `infini_wasm_bg.wasm` asset beside the JavaScript glue.
 * @remarks Concurrent and repeated calls are coalesced by wasm-bindgen.
 */
export async function initializeInfini(source?: WasmSource): Promise<void> {
    initialization ??= (async () => {
        if (source === undefined) {
            await initializeWasm();
        } else {
            await initializeWasm({ module_or_path: source });
        }
    })();
    try {
        await initialization;
    } catch (error) {
        initialization = null;
        throw error;
    }
}
