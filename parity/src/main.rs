//! Parity check: encode the same vectors through the reference quantization
//! crate and through qpack-engine, and assert the packed bytes are identical.

use std::sync::atomic::AtomicBool;

use qpack_engine::{Distance, Quantizer};
use quantization::encoded_storage::TestEncodedStorageBuilder;
use quantization::encoded_vectors::{DistanceType, VectorParameters};
use quantization::turboquant::{get_quantized_vector_size, EncodedVectorsTQ, TQBits, TQMode};

/// Deterministic pseudo-random unit vectors (LCG).
struct Rng(u64);
impl Rng {
    fn f(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f32 / (1u64 << 31) as f32) - 1.0
    }
    fn unit(&mut self, dim: usize) -> Vec<f32> {
        let v: Vec<f32> = (0..dim).map(|_| self.f()).collect();
        let n: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        v.iter().map(|x| x / n).collect()
    }
}

fn main() {
    let dim = 384;
    let count = 200;
    let mut rng = Rng(42);
    let vectors: Vec<Vec<f32>> = (0..count).map(|_| rng.unit(dim)).collect();

    // Reference encode (Bits4, Cosine, Normal).
    let params = VectorParameters {
        dim,
        distance_type: DistanceType::Cosine,
        invert: false,
        deprecated_count: None,
    };
    let qsize = get_quantized_vector_size(&params, TQBits::Bits4, TQMode::Normal);
    let builder = TestEncodedStorageBuilder::new(None, qsize);
    let stopped = AtomicBool::new(false);
    let reference = EncodedVectorsTQ::encode(
        vectors.iter().map(|v| v.as_slice()),
        builder,
        &params,
        count,
        TQBits::Bits4,
        TQMode::Normal,
        1,
        None,
        &stopped,
    )
    .expect("reference encode failed");

    // Our engine.
    let ours = Quantizer::new(dim, 4, Distance::Cosine);

    let mut mismatches = 0usize;
    for i in 0..count {
        let ref_bytes = reference.get_quantized_vector(i as u32);
        let our_bytes = ours.encode(&vectors[i]);
        if ref_bytes.as_ref() != our_bytes.as_slice() {
            if mismatches < 3 {
                let n = ref_bytes.len().min(our_bytes.len());
                let first_diff = (0..n).find(|&k| ref_bytes[k] != our_bytes[k]);
                println!(
                    "vec {i}: len ref={} ours={}, first diff byte={:?}",
                    ref_bytes.len(),
                    our_bytes.len(),
                    first_diff
                );
            }
            mismatches += 1;
        }
    }

    if mismatches == 0 {
        println!("PARITY OK: {count} vectors encode byte-identical (Bits4/Cosine)");
    } else {
        println!("PARITY FAIL: {mismatches}/{count} vectors differ");
        std::process::exit(1);
    }
}
