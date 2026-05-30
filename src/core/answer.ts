import type { AskResult, QPackHit } from "./types";

/** Split text into trimmed sentences. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

/** Lowercased content terms (length > 3) used for lexical overlap scoring. */
function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 3);
}

/**
 * Compose a short extractive answer from the top hits: pick the sentences that
 * best overlap the query (cheap, deterministic, offline — no LLM), with sources.
 */
export function composeAnswer(query: string, hits: QPackHit[], maxSentences = 3): AskResult {
  if (hits.length === 0) {
    return { answer: "I couldn't find anything about that.", sources: [] };
  }

  const qTerms = new Set(terms(query));
  const candidates: { score: number; order: number; text: string }[] = [];

  // Consider sentences from the strongest few hits.
  hits.slice(0, 3).forEach((hit, hitIdx) => {
    sentences(hit.doc.text).forEach((sentence, sIdx) => {
      let overlap = 0;
      for (const t of terms(sentence)) if (qTerms.has(t)) overlap++;
      // Weight by hit rank so a top-hit sentence wins ties.
      const score = overlap + (hits.length - hitIdx) * 0.01;
      candidates.push({ score, order: hitIdx * 1000 + sIdx, text: sentence });
    });
  });

  const picked = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.order - b.order);

  // Fallback: if nothing overlaps lexically, use the top hit's opening sentences.
  const answer =
    picked.length > 0
      ? picked.map((p) => p.text).join(" ")
      : sentences(hits[0].doc.text).slice(0, maxSentences).join(" ");

  return { answer, sources: hits };
}
