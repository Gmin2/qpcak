import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const TEXT_EXTS = new Set([".md", ".markdown", ".txt"]);

/** A raw content file read from disk. */
export interface SourceFile {
  path: string;
  rel: string;
  text: string;
}

/** Load text files from a file path or directory (recursively). */
export function loadSource(source: string | string[]): SourceFile[] {
  const roots = Array.isArray(source) ? source : [source];
  const files: SourceFile[] = [];
  for (const s of roots) {
    const st = statSync(s);
    if (st.isDirectory()) walk(s, s, files);
    else files.push({ path: s, rel: basename(s), text: readFileSync(s, "utf8") });
  }
  return files;
}

function walk(dir: string, root: string, out: SourceFile[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, root, out);
    else if (TEXT_EXTS.has(extname(name).toLowerCase()))
      out.push({ path: full, rel: relative(root, full), text: readFileSync(full, "utf8") });
  }
}
