/**
 * Resolve content file paths to their real published URLs using the site's
 * sitemap.xml, so links never 404. We match by the last path segment (the
 * page slug), which is stable even when directory nesting differs between the
 * content tree and the live site.
 */

/** Fetch and parse all <loc> URLs from a sitemap. */
export async function fetchSitemap(sitemapUrl: string): Promise<string[]> {
  const xml = await (await fetch(sitemapUrl)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** Last non-empty path segment of a URL or path (the page slug). */
function slugOf(s: string): string {
  return s.replace(/\.md$/i, "").replace(/\/?(_index|index)$/i, "").replace(/\/+$/, "").split("/").pop() ?? "";
}

/** Build a slug → URL index from sitemap URLs. */
export function indexSitemap(urls: string[]): Map<string, string> {
  const byslug = new Map<string, string>();
  for (const url of urls) {
    const slug = slugOf(url);
    if (slug && !byslug.has(slug)) byslug.set(slug, url);
  }
  return byslug;
}

/** Resolve a content-relative path to its real URL via the slug index. */
export function resolveUrl(index: Map<string, string>, rel: string): string | undefined {
  return index.get(slugOf(rel));
}
