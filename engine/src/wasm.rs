//! wasm-bindgen surface: the `QPack` class JavaScript drives.
//!
//!   const qp = new QPack(dim, bits, "cosine");
//!   qp.add(new Float32Array(dim));            // index a raw vector
//!   const res = qp.search(query, 5);          // -> {indices, scores}
//!
//! Vectors cross as Float32Array; results come back as a small struct.

use wasm_bindgen::prelude::*;

use crate::index::Index;
use crate::quantizer::Distance;

/// Search results: parallel arrays of point indices and their scores.
#[wasm_bindgen]
pub struct SearchResult {
    indices: Vec<u32>,
    scores: Vec<f32>,
}

#[wasm_bindgen]
impl SearchResult {
    #[wasm_bindgen(getter)]
    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn scores(&self) -> Vec<f32> {
        self.scores.clone()
    }
}

/// Browser-facing TurboQuant index.
#[wasm_bindgen]
pub struct QPack {
    index: Index,
}

#[wasm_bindgen]
impl QPack {
    /// Create an index. `distance` is "cosine" or "dot"; `bits` is 1, 2, or 4.
    #[wasm_bindgen(constructor)]
    pub fn new(dim: usize, bits: u8, distance: &str) -> Result<QPack, JsError> {
        let distance = match distance {
            "cosine" => Distance::Cosine,
            "dot" => Distance::Dot,
            other => return Err(JsError::new(&format!("unknown distance: {other}"))),
        };
        if !matches!(bits, 1 | 2 | 4) {
            return Err(JsError::new("bits must be 1, 2, or 4"));
        }
        Ok(QPack { index: Index::new(dim, bits, distance) })
    }

    /// Load an index from a serialized `.qpack` byte container.
    #[wasm_bindgen(js_name = fromPack)]
    pub fn from_pack(bytes: &[u8]) -> Result<QPack, JsError> {
        Index::from_pack(bytes)
            .map(|index| QPack { index })
            .map_err(JsError::new)
    }

    /// Serialize the index to a `.qpack` byte container.
    #[wasm_bindgen(js_name = toPack)]
    pub fn to_pack(&self) -> Vec<u8> {
        self.index.to_pack_self()
    }

    /// Encode and add a raw vector to the index.
    pub fn add(&mut self, vector: &[f32]) {
        self.index.add(vector);
    }

    /// Append already-encoded vectors (a pack's vector blob).
    pub fn add_encoded(&mut self, bytes: &[u8]) {
        self.index.add_encoded(bytes);
    }

    /// Number of indexed vectors.
    #[wasm_bindgen(getter)]
    pub fn size(&self) -> usize {
        self.index.count()
    }

    /// Bytes per encoded vector.
    #[wasm_bindgen(getter)]
    pub fn stride(&self) -> usize {
        self.index.stride()
    }

    /// Top-k search for a raw query vector.
    pub fn search(&self, query: &[f32], k: usize) -> SearchResult {
        let hits = self.index.search(query, k);
        SearchResult {
            indices: hits.iter().map(|h| h.index).collect(),
            scores: hits.iter().map(|h| h.score).collect(),
        }
    }
}
