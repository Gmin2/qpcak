//! Lloyd-Max scalar quantization codebooks for the standard normal N(0,1).
//! One universal codebook per bit-width; values map to the nearest centroid.

/// Centroids per bit-width (1, 2, 4 bit). 1.5-bit reuses the 1-bit codebook.
pub fn centroids(bits: u8) -> &'static [f32] {
    match bits {
        1 => &[-0.797_884_6, 0.797_884_6],
        2 => &[-1.510, -0.4528, 0.4528, 1.510],
        4 => &[
            -2.733, -2.069, -1.618, -1.256, -0.9424, -0.6568, -0.3881, -0.1284, 0.1284, 0.3881,
            0.6568, 0.9424, 1.256, 1.618, 2.069, 2.733,
        ],
        _ => panic!("unsupported bit width: {bits}"),
    }
}

/// Decision boundaries: midpoints between consecutive centroids. A value maps to
/// centroid `i` if it lies between boundary `i-1` and boundary `i`.
pub fn boundaries(bits: u8) -> Vec<f32> {
    let c = centroids(bits);
    (0..c.len() - 1).map(|i| (c[i] + c[i + 1]) / 2.0).collect()
}

/// Nearest centroid index for a value via boundary search.
#[inline]
pub fn quantize(value: f32, bounds: &[f32]) -> usize {
    bounds.partition_point(|&b| value > b)
}
