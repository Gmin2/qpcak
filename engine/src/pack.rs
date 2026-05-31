//! Self-describing `.qpack` binary container: a small header followed by the
//! concatenated TurboQuant-encoded vectors. Payloads (text/titles) live in a
//! separate JSON file alongside it, keeping this file purely numeric.
//!
//! Layout (little-endian):
//!   magic   "QPCK"            4 bytes
//!   version u32               1
//!   dim     u32               original embedding dimension
//!   bits    u32               1 | 2 | 4
//!   distance u32              0 = cosine, 1 = dot
//!   count   u32               number of vectors
//!   stride  u32               bytes per encoded vector
//!   data    [u8; count*stride]

use crate::quantizer::Distance;

const MAGIC: &[u8; 4] = b"QPCK";
const VERSION: u32 = 1;
const HEADER_LEN: usize = 4 + 4 * 6;

/// Parsed pack header.
pub struct PackHeader {
    pub dim: usize,
    pub bits: u8,
    pub distance: Distance,
    pub count: usize,
    pub stride: usize,
}

fn dist_code(d: Distance) -> u32 {
    match d {
        Distance::Cosine => 0,
        Distance::Dot => 1,
    }
}

fn dist_from_code(c: u32) -> Distance {
    match c {
        1 => Distance::Dot,
        _ => Distance::Cosine,
    }
}

/// Serialize a pack from the encoded vector blob and its parameters.
pub fn write_pack(
    dim: usize,
    bits: u8,
    distance: Distance,
    count: usize,
    stride: usize,
    data: &[u8],
) -> Vec<u8> {
    let mut out = Vec::with_capacity(HEADER_LEN + data.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&VERSION.to_le_bytes());
    out.extend_from_slice(&(dim as u32).to_le_bytes());
    out.extend_from_slice(&(bits as u32).to_le_bytes());
    out.extend_from_slice(&dist_code(distance).to_le_bytes());
    out.extend_from_slice(&(count as u32).to_le_bytes());
    out.extend_from_slice(&(stride as u32).to_le_bytes());
    out.extend_from_slice(data);
    out
}

/// Parse a pack header, returning it plus the offset where vector data begins.
pub fn read_header(bytes: &[u8]) -> Result<(PackHeader, usize), &'static str> {
    if bytes.len() < HEADER_LEN || &bytes[0..4] != MAGIC {
        return Err("not a qpack file");
    }
    let u32_at = |o: usize| u32::from_le_bytes([bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]]);
    if u32_at(4) != VERSION {
        return Err("unsupported qpack version");
    }
    let header = PackHeader {
        dim: u32_at(8) as usize,
        bits: u32_at(12) as u8,
        distance: dist_from_code(u32_at(16)),
        count: u32_at(20) as usize,
        stride: u32_at(24) as usize,
    };
    Ok((header, HEADER_LEN))
}
