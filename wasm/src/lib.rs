//! qpack-wasm: numeric scoring kernels compiled to WebAssembly.
//!
//! Memory model: JS allocates buffers inside the module's linear memory via
//! `alloc`, writes data there, and passes byte offsets to the kernels. We use
//! the standard wasm allocator (no wasm-bindgen) over a shared ArrayBuffer.

use std::alloc::{alloc as std_alloc, Layout};

/// Allocate `bytes` and return the offset into linear memory. Never freed
/// (packs are loaded once and live for the page's lifetime).
#[no_mangle]
pub extern "C" fn alloc(bytes: usize) -> *mut u8 {
    unsafe { std_alloc(Layout::from_size_align(bytes.max(1), 8).unwrap()) }
}

/// Smoke-test export (kept from 7a).
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// Dot product of the query (`q_ptr`, length `dim`) against stored f32 vector
/// `i` in the contiguous block at `v_ptr` (count * dim floats).
#[no_mangle]
pub extern "C" fn score_f32(v_ptr: *const f32, q_ptr: *const f32, dim: usize, i: usize) -> f32 {
    unsafe {
        let v = core::slice::from_raw_parts(v_ptr.add(i * dim), dim);
        let q = core::slice::from_raw_parts(q_ptr, dim);
        let mut s = 0.0f32;
        for d in 0..dim {
            s += q[d] * v[d];
        }
        s
    }
}

/// Score the query against every vector, writing `count` scores to `out_ptr`.
/// One JS↔wasm call for the whole batch (the fast path).
#[no_mangle]
pub extern "C" fn score_f32_batch(
    v_ptr: *const f32,
    q_ptr: *const f32,
    dim: usize,
    count: usize,
    out_ptr: *mut f32,
) {
    unsafe {
        let q = core::slice::from_raw_parts(q_ptr, dim);
        let out = core::slice::from_raw_parts_mut(out_ptr, count);
        for i in 0..count {
            let v = core::slice::from_raw_parts(v_ptr.add(i * dim), dim);
            let mut s = 0.0f32;
            for d in 0..dim {
                s += q[d] * v[d];
            }
            out[i] = s;
        }
    }
}

/// TurboQuant batch scoring.
///
/// For each stored vector i: unpack its `bits`-wide codes (over `pdim`
/// coordinates), look up each code in `codebook` (2^bits f32 centroids), dot
/// against the already-rotated query `rotq` (length `pdim`), and multiply by the
/// per-vector length scalar `alpha[i]`. Writes `count` scores to `out_ptr`.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn score_tq_batch(
    packed_ptr: *const u8,
    rotq_ptr: *const f32,
    codebook_ptr: *const f32,
    alpha_ptr: *const f32,
    bits: usize,
    pdim: usize,
    count: usize,
    out_ptr: *mut f32,
) {
    unsafe {
        let per_vec_bytes = (pdim * bits) >> 3;
        let rotq = core::slice::from_raw_parts(rotq_ptr, pdim);
        let codebook = core::slice::from_raw_parts(codebook_ptr, 1usize << bits);
        let alpha = core::slice::from_raw_parts(alpha_ptr, count);
        let packed = core::slice::from_raw_parts(packed_ptr, count * per_vec_bytes);
        let out = core::slice::from_raw_parts_mut(out_ptr, count);
        let mask = (1u32 << bits) - 1;

        for i in 0..count {
            let base = i * per_vec_bytes;
            let mut s = 0.0f32;
            for d in 0..pdim {
                let bit = d * bits;
                let idx = ((packed[base + (bit >> 3)] as u32) >> (bit & 7)) & mask;
                s += rotq[d] * codebook[idx as usize];
            }
            out[i] = s * alpha[i];
        }
    }
}
