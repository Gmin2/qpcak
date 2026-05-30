/** Raw exports from the qpack-wasm module. */
export interface QPackWasmExports {
  memory: WebAssembly.Memory;
  alloc(bytes: number): number;
  add(a: number, b: number): number;
  score_f32(vPtr: number, qPtr: number, dim: number, i: number): number;
  score_f32_batch(vPtr: number, qPtr: number, dim: number, count: number, outPtr: number): void;
  score_tq_batch(
    packedPtr: number,
    rotqPtr: number,
    codebookPtr: number,
    alphaPtr: number,
    bits: number,
    pdim: number,
    count: number,
    outPtr: number,
  ): void;
}

/** Instantiate the wasm module from raw bytes (works in node and the browser). */
export async function initWasm(wasmBytes: BufferSource): Promise<QPackWasmExports> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  return instance.exports as unknown as QPackWasmExports;
}

/**
 * Copy a Float32Array into wasm memory; returns its byte offset.
 * Read `w.memory.buffer` after alloc — growth detaches the old buffer.
 */
export function putF32(w: QPackWasmExports, arr: Float32Array): number {
  const ptr = w.alloc(arr.byteLength);
  new Float32Array(w.memory.buffer, ptr, arr.length).set(arr);
  return ptr;
}

/** Copy a Uint8Array into wasm memory; returns its byte offset. */
export function putU8(w: QPackWasmExports, arr: Uint8Array): number {
  const ptr = w.alloc(arr.byteLength);
  new Uint8Array(w.memory.buffer, ptr, arr.length).set(arr);
  return ptr;
}
