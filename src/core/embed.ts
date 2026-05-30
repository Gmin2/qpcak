import { pipeline } from "@huggingface/transformers";

/** Default embedding model; the browser runtime uses this same model. */
export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIM = 384;

const extractors = new Map<string, Promise<unknown>>();

function getExtractor(model: string): Promise<unknown> {
  if (!extractors.has(model)) {
    extractors.set(model, pipeline("feature-extraction", model));
  }
  return extractors.get(model)!;
}

/** Embed texts; returns one mean-pooled, L2-normalized Float32Array(dim) per input. */
export async function embed(texts: string[], model = DEFAULT_MODEL): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = (await getExtractor(model)) as (
    input: string[],
    opts: { pooling: "mean"; normalize: boolean },
  ) => Promise<{ data: Float32Array; dims: number[] }>;
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const dim = out.dims[out.dims.length - 1];
  const result: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    result.push(out.data.slice(i * dim, (i + 1) * dim));
  }
  return result;
}

/** Embed a single string. */
export async function embedOne(text: string, model = DEFAULT_MODEL): Promise<Float32Array> {
  return (await embed([text], model))[0];
}
