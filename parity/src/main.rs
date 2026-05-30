//! Parity check: encode the same vectors through the reference quantization
//! crate and through qpack-engine, and assert the packed bytes are identical
//! across every supported bit-width and distance.

use std::sync::atomic::AtomicBool;

use qpack_engine::{Distance, Quantizer};
use quantization::encoded_storage::TestEncodedStorageBuilder;
use quantization::encoded_vectors::{DistanceType, VectorParameters};
use quantization::turboquant::{get_quantized_vector_size, EncodedVectorsTQ, TQBits, TQMode};

/// Deterministic pseudo-random vectors (LCG).
struct Rng(u64);
impl Rng {
    fn f(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f32 / (1u64 << 31) as f32) - 1.0
    }
    fn vec(&mut self, dim: usize) -> Vec<f32> {
        (0..dim).map(|_| self.f()).collect()
    }
    fn unit(&mut self, dim: usize) -> Vec<f32> {
        let v = self.vec(dim);
        let n: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        v.iter().map(|x| x / n).collect()
    }
}

fn run_case(dim: usize, count: usize, bits: u8, distance: Distance) -> usize {
    let (tq_bits, dist_type, our_dist) = match (bits, distance) {
        (4, Distance::Cosine) => (TQBits::Bits4, DistanceType::Cosine, Distance::Cosine),
        (2, Distance::Cosine) => (TQBits::Bits2, DistanceType::Cosine, Distance::Cosine),
        (1, Distance::Cosine) => (TQBits::Bits1, DistanceType::Cosine, Distance::Cosine),
        (4, Distance::Dot) => (TQBits::Bits4, DistanceType::Dot, Distance::Dot),
        (2, Distance::Dot) => (TQBits::Bits2, DistanceType::Dot, Distance::Dot),
        (1, Distance::Dot) => (TQBits::Bits1, DistanceType::Dot, Distance::Dot),
        _ => unreachable!(),
    };

    let mut rng = Rng(42);
    // Cosine expects unit-norm inputs; Dot uses arbitrary-magnitude vectors.
    let vectors: Vec<Vec<f32>> = (0..count)
        .map(|_| match distance {
            Distance::Cosine => rng.unit(dim),
            Distance::Dot => rng.vec(dim),
        })
        .collect();

    let params = VectorParameters {
        dim,
        distance_type: dist_type,
        invert: false,
        deprecated_count: None,
    };
    let qsize = get_quantized_vector_size(&params, tq_bits, TQMode::Normal);
    let builder = TestEncodedStorageBuilder::new(None, qsize);
    let stopped = AtomicBool::new(false);
    let reference = EncodedVectorsTQ::encode(
        vectors.iter().map(|v| v.as_slice()),
        builder,
        &params,
        count,
        tq_bits,
        TQMode::Normal,
        1,
        None,
        &stopped,
    )
    .expect("reference encode failed");

    let ours = Quantizer::new(dim, bits, our_dist);

    let mut mismatches = 0usize;
    for i in 0..count {
        let ref_bytes = reference.get_quantized_vector(i as u32);
        let our_bytes = ours.encode(&vectors[i]);
        if ref_bytes.as_ref() != our_bytes.as_slice() {
            mismatches += 1;
        }
    }
    mismatches
}

fn main() {
    let dim = 384;
    let count = 200;
    let cases = [
        (4, Distance::Cosine, "Bits4/Cosine"),
        (2, Distance::Cosine, "Bits2/Cosine"),
        (1, Distance::Cosine, "Bits1/Cosine"),
        (4, Distance::Dot, "Bits4/Dot"),
        (2, Distance::Dot, "Bits2/Dot"),
        (1, Distance::Dot, "Bits1/Dot"),
    ];

    let mut failed = false;
    for (bits, distance, label) in cases {
        let mismatches = run_case(dim, count, bits, distance);
        if mismatches == 0 {
            println!("OK   {label}: {count}/{count} byte-identical");
        } else {
            println!("FAIL {label}: {mismatches}/{count} differ");
            failed = true;
        }
    }

    if failed {
        std::process::exit(1);
    }
    println!("\nPARITY OK across all bit-widths and distances");
}
