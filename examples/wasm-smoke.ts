import { readFile } from "node:fs/promises";

/** Step 7a: load the compiled wasm and call a trivial export. */
const path = "wasm/target/wasm32-unknown-unknown/release/qpack_wasm.wasm";
const bytes = await readFile(path);
const { instance } = await WebAssembly.instantiate(bytes, {});
const add = instance.exports.add as (a: number, b: number) => number;

console.log("wasm loaded:", path);
console.log("add(2, 3) =", add(2, 3));
if (add(2, 3) !== 5) throw new Error("wasm add failed");
console.log("7a OK");
