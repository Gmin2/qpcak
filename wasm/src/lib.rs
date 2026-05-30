//! qpack-wasm: numeric scoring kernels compiled to WebAssembly.
//! Step 7a: a trivial export to validate the toolchain and JS loading.

/// Smoke-test export: proves the wasm module builds, loads, and calls.
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
