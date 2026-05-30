const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;
const CODE_FENCE = /```[\s\S]*?```/g;
const HTML_TAG = /<[^>]+>/g;
const MULTISPACE = /[ \t]+/g;

/** Strip frontmatter, code, HTML, and markdown markup; normalize whitespace. */
export function cleanMarkdown(raw: string): string {
  return raw
    .replace(FRONTMATTER, "")
    .replace(CODE_FENCE, " ")
    .replace(HTML_TAG, " ")
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1") // links -> text
    .replace(MULTISPACE, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort title: frontmatter `title:`, else first heading, else filename. */
export function deriveTitle(raw: string, fallback: string): string {
  const fm = raw.match(/^---\n[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*\n[\s\S]*?\n---/);
  if (fm) return fm[1].trim();
  const heading = raw.replace(FRONTMATTER, "").match(/^#{1,3}\s+(.+)$/m);
  if (heading && heading[1].length <= 80) return heading[1].trim();
  return fallback.replace(/\.[^.]+$/, "").replace(/[-_/]/g, " ").trim();
}

/** Split text into ~target-char chunks on paragraph boundaries. */
export function chunkText(text: string, target = 700): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length + 2 > target) {
      chunks.push(buf);
      buf = "";
    }
    if (p.length > target) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      for (let i = 0; i < p.length; i += target) chunks.push(p.slice(i, i + target));
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.filter((c) => c.length >= 40);
}
