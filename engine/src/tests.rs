//! Self-consistency tests for the TurboQuant engine: the score of a query
//! against its own encoded vector should recover the true similarity, ordering
//! should be preserved, and higher bit-widths should reduce error.

use crate::{Distance, Quantizer};

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(&x, &y)| x * y).sum()
}

fn norm(v: &[f32]) -> f32 {
    dot(v, v).sqrt()
}

fn normalize(v: &[f32]) -> Vec<f32> {
    let n = norm(v);
    v.iter().map(|&x| x / n).collect()
}

/// Deterministic pseudo-random vectors (LCG), no external rng needed.
struct Rng(u64);
impl Rng {
    fn f(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f32 / (1u64 << 31) as f32) - 1.0
    }
    fn vec(&mut self, dim: usize) -> Vec<f32> {
        (0..dim).map(|_| self.f()).collect()
    }
}

#[test]
fn cosine_self_similarity_is_one() {
    let mut rng = Rng(42);
    for &dim in &[128, 384, 512, 768] {
        for &bits in &[4u8, 2, 1] {
            let q = Quantizer::new(dim, bits, Distance::Cosine);
            let v = normalize(&rng.vec(dim));
            let enc = q.encode(&v);
            let rq = q.prepare_query(&v);
            let s = q.score(&rq, &enc);
            // 1-bit is coarse; tolerance scales with bit width.
            let tol = match bits {
                4 => 0.06,
                2 => 0.15,
                _ => 0.35,
            };
            assert!(
                (s - 1.0).abs() < tol,
                "dim={dim} bits={bits}: self-similarity {s} not ~1 (tol {tol})"
            );
        }
    }
}

#[test]
fn cosine_antipodal_is_negative() {
    let mut rng = Rng(7);
    for &dim in &[384, 512] {
        let q = Quantizer::new(dim, 4, Distance::Cosine);
        let v = normalize(&rng.vec(dim));
        let neg: Vec<f32> = v.iter().map(|&x| -x).collect();
        let enc_neg = q.encode(&neg);
        let s = q.score(&q.prepare_query(&v), &enc_neg);
        assert!(s < -0.8, "dim={dim}: antipodal {s} not ~-1");
    }
}

#[test]
fn rank_preservation() {
    let mut rng = Rng(123);
    let dim = 512;
    let q = Quantizer::new(dim, 4, Distance::Cosine);
    let query = normalize(&rng.vec(dim));
    // Candidates with decreasing true similarity to the query.
    let mut pairs: Vec<(f32, f32)> = Vec::new();
    for i in 1..=10 {
        let s = i as f32 / 10.0;
        let noise = rng.vec(dim);
        let cand: Vec<f32> = normalize(
            &query.iter().zip(&noise).map(|(&a, &n)| s * a + (1.0 - s) * n).collect::<Vec<_>>(),
        );
        let truth = dot(&query, &cand);
        let approx = q.score(&q.prepare_query(&query), &q.encode(&cand));
        pairs.push((truth, approx));
    }
    let n = pairs.len();
    let mut inversions = 0;
    let mut total = 0;
    for i in 0..n {
        for j in (i + 1)..n {
            total += 1;
            let ts = (pairs[i].0 - pairs[j].0).signum();
            let asx = (pairs[i].1 - pairs[j].1).signum();
            if ts != 0.0 && ts != asx {
                inversions += 1;
            }
        }
    }
    assert!(inversions * 100 < 15 * total, "{inversions}/{total} pairs inverted");
}

#[test]
fn higher_bits_reduce_error() {
    let mae = |bits: u8| -> f32 {
        let mut rng = Rng(99);
        let dim = 512;
        let q = Quantizer::new(dim, bits, Distance::Cosine);
        let mut total = 0.0;
        let n = 30;
        for _ in 0..n {
            let a = normalize(&rng.vec(dim));
            let b = normalize(&rng.vec(dim));
            let truth = dot(&a, &b);
            let approx = q.score(&q.prepare_query(&a), &q.encode(&b));
            total += (approx - truth).abs();
        }
        total / n as f32
    };
    let (m4, m2, m1) = (mae(4), mae(2), mae(1));
    assert!(m4 <= m2 + 0.02 && m2 <= m1 + 0.02, "MAE not monotonic: 4={m4} 2={m2} 1={m1}");
}

#[test]
fn vector_bytes_match_layout() {
    // 384-dim: 4-bit -> 384/2=192 + 4 = 196; 2-bit -> 96+4=100; 1-bit -> 48+4=52.
    assert_eq!(Quantizer::new(384, 4, Distance::Cosine).vector_bytes(), 196);
    assert_eq!(Quantizer::new(384, 2, Distance::Cosine).vector_bytes(), 100);
    assert_eq!(Quantizer::new(384, 1, Distance::Cosine).vector_bytes(), 52);
}
