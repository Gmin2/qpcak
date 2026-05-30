import type { BuildOptions, BuildResult } from "./core/types";

export type * from "./core/types";

/** Index content into a static pack (manifest + payloads + vectors). */
export async function buildPack(_opts: BuildOptions): Promise<BuildResult> {
  throw new Error("qpack/build: buildPack not implemented yet");
}
