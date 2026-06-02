#!/usr/bin/env node
/**
 * qpack CLI: turn a folder/file of content into a compressed `.qpack` semantic
 * pack that runs in the browser.
 *
 *   npx qpcak build ./docs --out site --sitemap https://site.com/sitemap.xml
 */
import { buildPack } from "./build";
import type { VectorFormat } from "./core/types";

const HELP = `qpcak — build a browser-searchable semantic pack from your content

Usage:
  qpcak build <source> [options]

Arguments:
  <source>            File or directory of .md/.txt content to index

Options:
  --out <dir>         Output directory for the pack (default: ./qpack-out)
  --name <name>       Pack name (default: out dir name)
  --bits <4|2|1>      TurboQuant bit depth (default: 4 = ~8x smaller)
  --sitemap <url>     Resolve clickable source URLs from this sitemap.xml
  --qdrant <url>      Route through a Qdrant origin (source of truth)
  -h, --help          Show this help

Example:
  qpcak build ./docs --out public/packs/docs --sitemap https://mysite.com/sitemap.xml
`;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[++i] ?? "";
    else if (a === "-h") out.help = "true";
    else if (!out._source) out._source = a;
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === "-h" || cmd === "--help" || args.help || !cmd) {
    console.log(HELP);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd !== "build") {
    console.error(`Unknown command: ${cmd}\n`);
    console.log(HELP);
    process.exit(1);
  }

  const source = args._source;
  if (!source) {
    console.error("Error: missing <source>.\n");
    console.log(HELP);
    process.exit(1);
  }

  const compress = (args.bits ? `tq${args.bits}` : "tq4") as VectorFormat;
  const out = args.out ?? "./qpack-out";

  console.log(`Building pack from ${source} …`);
  const result = await buildPack({
    source,
    out,
    name: args.name,
    compress,
    sitemap: args.sitemap,
    qdrantUrl: args.qdrant,
  });

  console.log(`\n✓ Pack built`);
  console.log(`  ${result.count} chunks · ${result.vectorFormat} · ${(result.bytes / 1024).toFixed(1)} KB`);
  console.log(`  → ${result.out}`);
}

main().catch((err) => {
  console.error("qpcak: " + (err?.message ?? err));
  process.exit(1);
});
