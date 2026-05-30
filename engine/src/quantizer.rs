//! TurboQuant encoder + asymmetric scorer (Cosine/Dot, no error-correction).
//!
//! Encode: pad → rotate → length-rescale to sqrt(dim) → map each coordinate to
//! its nearest Lloyd-Max centroid → bit-pack, storing a per-vector scaling
//! factor `l2 / centroid_norm` for renormalized scoring.
//!
//! Score (query vs stored): rotate the full-precision query once, dot it
//! against the stored centroids, multiply by the stored scaling factor.

use crate::codebook::{boundaries, centroids, quantize};
use crate::rotation::Rotation;

/// Distance metric. Cosine expects unit-norm inputs.
#[derive(Clone, Copy, PartialEq)]
pub enum Distance {
    Cosine,
    Dot,
}

/// Padded working dimension for a given bit width (whole bytes per vector).
fn padded_dim(dim: usize, bits: u8) -> usize {
    match bits {
        1 => dim.next_multiple_of(8),
        2 => dim.next_multiple_of(4),
        4 => dim.next_multiple_of(2),
        _ => panic!("unsupported bits {bits}"),
    }
}

/// A configured TurboQuant quantizer for a fixed dim/bits/distance.
pub struct Quantizer {
    rotation: Rotation,
    bits: u8,
    distance: Distance,
    dim: usize,
    pdim: usize,
    centroids: &'static [f32],
    boundaries: Vec<f32>,
}

/// Bytes per packed (dimension-only) vector, excluding the trailing scale f32.
fn packed_bytes(pdim: usize, bits: u8) -> usize {
    pdim * bits as usize / 8
}

impl Quantizer {
    pub fn new(dim: usize, bits: u8, distance: Distance) -> Self {
        let pdim = padded_dim(dim, bits);
        Self {
            rotation: Rotation::new(pdim),
            bits,
            distance,
            dim,
            pdim,
            centroids: centroids(bits),
            boundaries: boundaries(bits),
        }
    }

    /// Total stored bytes per vector: packed codes + one f32 scaling factor.
    pub fn vector_bytes(&self) -> usize {
        packed_bytes(self.pdim, self.bits) + 4
    }

    /// Pad `vec` to pdim, rotate, and rescale so the L2 norm is sqrt(pdim).
    /// Returns the rotated/rescaled buffer and the original rotated L2 length.
    fn preprocess(&self, vec: &[f32]) -> (Vec<f64>, f64) {
        let mut buf = vec![0.0f64; self.pdim];
        for (b, &x) in buf.iter_mut().zip(vec.iter()) {
            *b = x as f64;
        }
        self.rotation.apply(&mut buf);
        let l2: f64 = buf.iter().map(|&x| x * x).sum::<f64>().sqrt();
        if l2 > 0.0 {
            let s = (self.pdim as f64).sqrt() / l2;
            for v in buf.iter_mut() {
                *v *= s;
            }
        }
        (buf, l2)
    }

    /// Encode one vector into `packed codes || scaling_factor(f32 LE)`.
    pub fn encode(&self, vec: &[f32]) -> Vec<u8> {
        let (buf, l2) = self.preprocess(vec);

        // Pack nearest-centroid indices, LSB-first, `bits` per coordinate.
        let mut out = vec![0u8; packed_bytes(self.pdim, self.bits)];
        let mut bitpos = 0usize;
        let mut cn_sq = 0.0f64; // centroid-norm² of the chosen centroids
        for &val in buf.iter() {
            let idx = quantize(val as f32, &self.boundaries);
            let c = self.centroids[idx] as f64;
            cn_sq += c * c;
            let byte = bitpos / 8;
            let shift = bitpos % 8;
            out[byte] |= (idx as u8) << shift;
            bitpos += self.bits as usize;
        }

        let cn = cn_sq.sqrt();
        // Cosine treats l2 as 1.0 (inputs are unit norm); Dot keeps the real l2.
        let l2_for_scale = match self.distance {
            Distance::Cosine => 1.0,
            Distance::Dot => l2,
        };
        let scaling = if cn > 0.0 { (l2_for_scale / cn) as f32 } else { 0.0 };
        out.extend_from_slice(&scaling.to_le_bytes());
        out
    }

    /// Rotate a query once for repeated scoring (pad → rotate, full precision).
    pub fn prepare_query(&self, query: &[f32]) -> Vec<f64> {
        let mut buf = vec![0.0f64; self.pdim];
        for (b, &x) in buf.iter_mut().zip(query.iter()) {
            *b = x as f64;
        }
        self.rotation.apply(&mut buf);
        buf
    }

    /// Asymmetric score of a prepared (rotated) query against a stored vector.
    pub fn score(&self, rotated_query: &[f64], stored: &[u8]) -> f32 {
        let pbytes = packed_bytes(self.pdim, self.bits);
        let scaling = f32::from_le_bytes([
            stored[pbytes],
            stored[pbytes + 1],
            stored[pbytes + 2],
            stored[pbytes + 3],
        ]) as f64;

        let mask = (1u8 << self.bits) - 1;
        let mut dot = 0.0f64;
        let mut bitpos = 0usize;
        for d in 0..self.pdim {
            let byte = bitpos / 8;
            let shift = bitpos % 8;
            let idx = ((stored[byte] >> shift) & mask) as usize;
            dot += rotated_query[d] * self.centroids[idx] as f64;
            bitpos += self.bits as usize;
        }
        (dot * scaling) as f32
    }

    pub fn dim(&self) -> usize {
        self.dim
    }
}
