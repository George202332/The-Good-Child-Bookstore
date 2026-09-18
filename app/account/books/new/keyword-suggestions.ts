const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "for", "with", "at", "by", "from", "as", "that", "this", "these",
  "those", "it", "its", "his", "her", "their", "our", "your", "my", "i", "he", "she", "they",
  "we", "you", "will", "would", "can", "could", "should", "about", "into", "over", "than",
  "then", "so", "if", "when", "while", "up", "out", "not", "no", "yes", "all", "some", "one",
  "two", "three", "just", "very", "more", "most", "much", "such", "there", "here", "how",
  "what", "who", "whom", "which", "has", "have", "had", "do", "does", "did", "book", "story",
]);

/** Extracts up to `max` single-word or short-phrase keyword candidates
 * from a plain-text description — strips HTML, lowercases, removes
 * stopwords/punctuation, and ranks by frequency then length (longer,
 * more specific words first among ties). Always editable afterward;
 * this only seeds the suggestion. */
export function extractSuggestedKeywords(text: string, max = 7): string[] {
  const plain = text.replace(/<[^>]+>/g, " ").toLowerCase();
  const words = plain.match(/[a-z][a-z'-]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))
    .slice(0, max)
    .map(([w]) => w);
}
