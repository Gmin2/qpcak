//! qpack-engine: TurboQuant vector compression + search, for native and WASM.

mod codebook;
mod quantizer;
mod rotation;

#[cfg(test)]
mod tests;

pub use quantizer::{Distance, Quantizer};
