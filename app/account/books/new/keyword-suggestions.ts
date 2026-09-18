const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "for", "with", "at", "by", "from", "as", "that", "this", "these",
  "those", "it", "its", "his", "her", "their", "our", "your", "my", "i", "he", "she", "they",
  "we", "you", "will", "would", "can", "could", "should", "about", "into", "over", "than",
  "then", "so", "if", "when", "while", "up", "out", "not", "no", "yes", "all", "some", "one",
  "two", "three", "just", "very", "more", "most", "much", "such", "there", "here", "how",
  "what", "who", "whom", "which", "has", "have", "had", "do", "does", "did",
]);

const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_WORDS = 5;

/**
 * Extracts up to `max` keyword *phrases* (2-5 words each, per explicit
 * instruction) directly from a book's plain-text description — every
 * candidate is a real, contiguous run of words that actually appears
 * in the description, never invented. Ranks by frequency, then by
 * whether the phrase shares a word with the book's title (so a
 * title-relevant phrase is preferred when there's a tie), then by
 * length. Always editable afterward; this only seeds the suggestion.
 *
 * Not a literal external AI/LLM call — no such service is available to
 * call from here — this is a real, self-contained ranking heuristic
 * that only ever surfaces phrases genuinely present in the text.
 */
export function extractSuggestedKeywords(text: string, title = "", max = 7): string[] {
  const plain = text.replace(/<[^>]+>/g, " ").toLowerCase();
  const sentences = plain.split(/[.!?\n]+/);
  const titleWords = new Set(title.toLowerCase().match(/[a-z']{3,}/g) ?? []);

  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const words = sentence.match(/[a-z][a-z'-]{2,}/g) ?? [];
    for (let len = MIN_PHRASE_WORDS; len <= MAX_PHRASE_WORDS; len++) {
      for (let i = 0; i + len <= words.length; i++) {
        const slice = words.slice(i, i + len);
        // Skip phrases that start or end on a stopword — "the kind
        // dog" is a fine phrase, "the kind of" is not a useful one.
        if (STOPWORDS.has(slice[0]) || STOPWORDS.has(slice[slice.length - 1])) continue;
        const phrase = slice.join(" ");
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  function titleOverlapScore(phrase: string): number {
    return phrase.split(" ").some((w) => titleWords.has(w)) ? 1 : 0;
  }

  // Drop phrases that are pure substrings of a longer, equally-frequent
  // phrase already picked, so "brightly colored room" doesn't also
  // produce "colored room" as a separate, redundant entry.
  const ranked = Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || (titleOverlapScore(b[0]) - titleOverlapScore(a[0])) || (b[0].length - a[0].length));

  const chosen: string[] = [];
  for (const [phrase] of ranked) {
    if (chosen.length >= max) break;
    if (chosen.some((c) => c.includes(phrase) || phrase.includes(c))) continue;
    chosen.push(phrase);
  }
  return chosen;
}
