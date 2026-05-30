import type { WidgetOptions } from "./core/types";

export type * from "./core/types";

/** Mount a self-contained chat box that loads a pack and answers locally. */
export function mountChat(_opts: WidgetOptions): void {
  throw new Error("qpack/widget: mountChat not implemented yet");
}
