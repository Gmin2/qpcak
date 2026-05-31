//! qpack-engine: TurboQuant vector compression + search, for native and WASM.

mod codebook;
mod index;
mod pack;
mod quantizer;
mod rotation;

#[cfg(test)]
mod tests;

#[cfg(feature = "wasm")]
mod wasm;

pub use index::{Hit, Index};
pub use quantizer::{Distance, Quantizer};
