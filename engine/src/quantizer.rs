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

    /// Pad `vec` to pdim, rotate, and rescale so the L2 norm matches the
    /// codebook grid. Cosine treats the length as 1.0 (inputs are unit-norm);
    /// Dot uses the measured rotated L2. Returns the rescaled buffer and the
    /// L2 length used for the scaling factor.
    fn preprocess(&self, vec: &[f32]) -> (Vec<f64>, f64) {
        let mut buf = vec![0.0f64; self.pdim];
        for (b, &x) in buf.iter_mut().zip(vec.iter()) {
            *b = x as f64;
        }
        self.rotation.apply(&mut buf);
        let measured: f64 = buf.iter().map(|&x| x * x).sum::<f64>().sqrt();
        let length = match self.distance {
            Distance::Cosine => 1.0,
            Distance::Dot => measured,
        };
        if length > 0.0 {
            let s = (self.pdim as f64).sqrt() / length;
            for v in buf.iter_mut() {
                *v *= s;
            }
        }
        let l2_for_scale = match self.distance {
            Distance::Cosine => 1.0,
            Distance::Dot => measured,
        };
        (buf, l2_for_scale)
    }

    /// Encode one vector into `packed codes || scaling_factor(f32 LE)`.
    pub fn encode(&self, vec: &[f32]) -> Vec<u8> {
        let (buf, l2_for_scale) = self.preprocess(vec);

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

        // Round the centroid norm to f32 before dividing, matching the
        // reference's rounding order so the stored scaling factor is identical.
        let cn = cn_sq.sqrt() as f32;
        let scaling = if cn > 0.0 { l2_for_scale as f32 / cn } else { 0.0 };
        out.extend_from_slice(&scaling.to_le_bytes());
        out
    }

    /// Rotate a query once for repeated scoring (pad → rotate). Kept as f32 so
    /// the score loop can use wasm SIMD lanes directly.
    pub fn prepare_query(&self, query: &[f32]) -> Vec<f32> {
        let mut buf = vec![0.0f64; self.pdim];
        for (b, &x) in buf.iter_mut().zip(query.iter()) {
            *b = x as f64;
        }
        self.rotation.apply(&mut buf);
        buf.iter().map(|&x| x as f32).collect()
    }

    /// Centroid index for coordinate `d` from the bit-packed codes.
    #[inline]
    fn idx_at(&self, packed: &[u8], d: usize) -> usize {
        let bitpos = d * self.bits as usize;
        let mask = (1u8 << self.bits) - 1;
        ((packed[bitpos / 8] >> (bitpos % 8)) & mask) as usize
    }

    /// Asymmetric score of a prepared (rotated) query against a stored vector.
    pub fn score(&self, rotated_query: &[f32], stored: &[u8]) -> f32 {
        let pbytes = packed_bytes(self.pdim, self.bits);
        let scaling = f32::from_le_bytes([
            stored[pbytes],
            stored[pbytes + 1],
            stored[pbytes + 2],
            stored[pbytes + 3],
        ]);
        self.dot(rotated_query, &stored[..pbytes]) * scaling
    }

    /// Dot of the rotated query against the stored centroids (scalar path).
    #[cfg(not(target_feature = "simd128"))]
    fn dot(&self, q: &[f32], packed: &[u8]) -> f32 {
        let mut dot = 0.0f32;
        for d in 0..self.pdim {
            dot += q[d] * self.centroids[self.idx_at(packed, d)];
        }
        dot
    }

    /// Dot of the rotated query against the stored centroids (wasm SIMD path).
    /// The centroid gather is scalar; the multiply-accumulate runs 4 lanes wide.
    #[cfg(target_feature = "simd128")]
    fn dot(&self, q: &[f32], packed: &[u8]) -> f32 {
        use core::arch::wasm32::*;
        let mut acc = f32x4_splat(0.0);
        let c = self.centroids;
        let mut d = 0;
        while d + 4 <= self.pdim {
            let cv = f32x4(
                c[self.idx_at(packed, d)],
                c[self.idx_at(packed, d + 1)],
                c[self.idx_at(packed, d + 2)],
                c[self.idx_at(packed, d + 3)],
            );
            let qv = f32x4(q[d], q[d + 1], q[d + 2], q[d + 3]);
            acc = f32x4_add(acc, f32x4_mul(qv, cv));
            d += 4;
        }
        let mut dot = f32x4_extract_lane::<0>(acc)
            + f32x4_extract_lane::<1>(acc)
            + f32x4_extract_lane::<2>(acc)
            + f32x4_extract_lane::<3>(acc);
        while d < self.pdim {
            dot += q[d] * c[self.idx_at(packed, d)];
            d += 1;
        }
        dot
    }

    pub fn dim(&self) -> usize {
        self.dim
    }
}
