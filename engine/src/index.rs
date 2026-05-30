//! A flat (brute-force) index over TurboQuant-encoded vectors. Holds the
//! encoded bytes contiguously and scores a query against every vector.

use crate::quantizer::{Distance, Quantizer};

/// One search hit: the vector's position and its score.
pub struct Hit {
    pub index: u32,
    pub score: f32,
}

/// A flat index of encoded vectors, all sharing one quantizer config.
pub struct Index {
    quantizer: Quantizer,
    /// Concatenated encoded vectors, each `stride` bytes.
    data: Vec<u8>,
    stride: usize,
    count: usize,
}

impl Index {
    /// Create an empty index for `dim`/`bits`/`distance`.
    pub fn new(dim: usize, bits: u8, distance: Distance) -> Self {
        let quantizer = Quantizer::new(dim, bits, distance);
        let stride = quantizer.vector_bytes();
        Self { quantizer, data: Vec::new(), stride, count: 0 }
    }

    /// Encode and append a raw vector.
    pub fn add(&mut self, vec: &[f32]) {
        let enc = self.quantizer.encode(vec);
        debug_assert_eq!(enc.len(), self.stride);
        self.data.extend_from_slice(&enc);
        self.count += 1;
    }

    /// Append already-encoded vectors (e.g. loaded from a pack). `bytes.len()`
    /// must be a multiple of the stride.
    pub fn add_encoded(&mut self, bytes: &[u8]) {
        debug_assert_eq!(bytes.len() % self.stride, 0);
        self.count += bytes.len() / self.stride;
        self.data.extend_from_slice(bytes);
    }

    pub fn count(&self) -> usize {
        self.count
    }

    pub fn stride(&self) -> usize {
        self.stride
    }

    /// Top-k search for a raw query vector. Returns hits sorted by score desc.
    pub fn search(&self, query: &[f32], k: usize) -> Vec<Hit> {
        let rotated = self.quantizer.prepare_query(query);
        let mut top: Vec<Hit> = Vec::with_capacity(k + 1);
        for i in 0..self.count {
            let start = i * self.stride;
            let stored = &self.data[start..start + self.stride];
            let score = self.quantizer.score(&rotated, stored);
            insert_top(&mut top, Hit { index: i as u32, score }, k);
        }
        top
    }
}

/// Insert into a descending-sorted top-k buffer, dropping the smallest.
fn insert_top(top: &mut Vec<Hit>, hit: Hit, k: usize) {
    if top.len() == k && hit.score <= top[top.len() - 1].score {
        return;
    }
    let pos = top.partition_point(|h| h.score > hit.score);
    top.insert(pos, hit);
    if top.len() > k {
        top.pop();
    }
}
