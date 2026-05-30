//! Orthonormal rotation: variable power-of-2 Walsh-Hadamard chunks interleaved
//! with three fixed reversible permutations. Spreads per-coordinate variance so
//! rotated coordinates look ~N(0,1), and preserves dot products / L2 norm.

const N_PERMUTATIONS: usize = 3;

/// Fixed permutation seeds. Baked into every encoded vector; must never change.
const PERMUTATION_SEEDS: [u64; N_PERMUTATIONS] =
    [654605292835415893, 8636605637963351413, 1775280196666917949];

/// Reversible LCG (Knuth MMIX constants) for an in-place Fisher-Yates shuffle
/// that needs no stored index map.
struct Lcg {
    state: u64,
}

impl Lcg {
    const A: u64 = 6_364_136_223_846_793_005;
    const C: u64 = 1_442_695_040_888_963_407;
    const A_INV: u64 = 13_877_824_140_714_322_085;

    fn new(seed: u64) -> Self {
        Self { state: seed }
    }
    #[inline]
    fn next(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(Self::A).wrapping_add(Self::C);
        self.state
    }
    #[inline]
    fn prev(&mut self) -> u64 {
        let v = self.state;
        self.state = self.state.wrapping_sub(Self::C).wrapping_mul(Self::A_INV);
        v
    }
}

/// Map a 64-bit draw to `[0, bound)` using the high bits (low LCG bits have
/// short periods).
#[inline]
fn bounded(val: u64, bound: u64) -> u64 {
    (val >> 32) % bound
}

/// An in-place permutation of `count` elements, replayed from a seed.
struct Permutation {
    seed: u64,
    count: usize,
    end_state: u64,
}

impl Permutation {
    fn new(seed: u64, count: usize) -> Self {
        let mut rng = Lcg::new(seed);
        for _ in 1..count {
            rng.next();
        }
        Self { seed, count, end_state: rng.state }
    }

    fn permute(&self, arr: &mut [f64]) {
        let mut rng = Lcg::new(self.seed);
        for i in (1..self.count).rev() {
            let j = bounded(rng.next(), i as u64 + 1) as usize;
            arr.swap(i, j);
        }
    }

    #[allow(dead_code)]
    fn unpermute(&self, arr: &mut [f64]) {
        let mut rng = Lcg::new(self.end_state);
        for i in 1..self.count {
            let j = bounded(rng.prev(), i as u64 + 1) as usize;
            arr.swap(i, j);
        }
    }
}

/// In-place unnormalized Walsh-Hadamard transform; length must be a power of 2.
fn wht(x: &mut [f64]) {
    let n = x.len();
    let mut h = 1;
    while h < n {
        let mut i = 0;
        while i < n {
            for j in i..i + h {
                let a = x[j];
                let b = x[j + h];
                x[j] = a + b;
                x[j + h] = a - b;
            }
            i += h * 2;
        }
        h *= 2;
    }
}

/// Decompose `dim` into decreasing power-of-2 chunk sizes summing to `dim`.
fn chunk_sizes(dim: usize) -> Vec<usize> {
    let mut sizes = Vec::new();
    let mut bits = dim;
    while bits != 0 {
        let highest = 1usize << bits.ilog2();
        sizes.push(highest);
        bits ^= highest;
    }
    sizes
}

/// Hadamard rotation over the (already padded) working dimension.
pub struct Rotation {
    permutations: Vec<Permutation>,
    chunk_sizes: Vec<usize>,
    chunk_norms: Vec<f64>,
    dim: usize,
}

impl Rotation {
    pub fn new(dim: usize) -> Self {
        let chunk_sizes = chunk_sizes(dim);
        let chunk_norms = chunk_sizes.iter().map(|&s| 1.0 / (s as f64).sqrt()).collect();
        let permutations = PERMUTATION_SEEDS.iter().map(|&s| Permutation::new(s, dim)).collect();
        Self { permutations, chunk_sizes, chunk_norms, dim }
    }

    fn wht_chunks(&self, buf: &mut [f64]) {
        let mut offset = 0;
        for (&size, &norm) in self.chunk_sizes.iter().zip(&self.chunk_norms) {
            let chunk = &mut buf[offset..offset + size];
            wht(chunk);
            for v in chunk.iter_mut() {
                *v *= norm;
            }
            offset += size;
        }
    }

    /// Apply the rotation in place. `buf.len()` must equal the configured dim.
    pub fn apply(&self, buf: &mut [f64]) {
        debug_assert_eq!(buf.len(), self.dim);
        self.wht_chunks(buf);
        for p in &self.permutations {
            p.permute(buf);
            self.wht_chunks(buf);
        }
    }
}
