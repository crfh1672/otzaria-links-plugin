/**
 * Utility functions for Fuzzy Matching with slight flexibility (גמישות קלה בלבד)
 * Gives priority to exact matches while allowing small typos / spelling variations.
 */

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const lenA = a.length;
  const lenB = b.length;

  if (Math.abs(lenA - lenB) > 2) return Math.abs(lenA - lenB);

  let row = Array.from({ length: lenB + 1 }, (_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    const nextRow = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      nextRow[j] = Math.min(
        row[j] + 1,        // deletion
        nextRow[j - 1] + 1,  // insertion
        row[j - 1] + cost   // substitution
      );
    }
    row = nextRow;
  }
  return row[lenB];
}

/**
 * Calculates word similarity score between 0.0 and 1.0.
 * - Exact match: 1.0
 * - Slight fuzzy match: 0.75 to 0.95 depending on distance/length
 * - No match / too loose: 0.0
 * 
 * Rules for "slight flexibility" (גמישות קלה בלבד):
 * 1. Short words (length <= 3 Hebrew chars): MUST match exactly (returns 0 if not equal).
 * 2. Medium words (length 4..6 chars): Max edit distance = 1.
 * 3. Long words (length >= 7 chars): Max edit distance = 2.
 */
export function getWordSimilarity(w1: string, w2: string, enableFuzzy: boolean = true): number {
  if (w1 === w2) return 1.0;
  if (!enableFuzzy) return 0;

  const minLen = Math.min(w1.length, w2.length);
  const maxLen = Math.max(w1.length, w2.length);

  // Short words (length <= 3) must match exactly to avoid false positives in Hebrew
  if (minLen <= 3) {
    return 0;
  }

  const diffLen = maxLen - minLen;
  if (diffLen > 2) return 0;

  const dist = levenshteinDistance(w1, w2);
  const maxAllowedDist = minLen >= 7 ? 2 : 1;

  if (dist <= maxAllowedDist) {
    const sim = 1 - dist / maxLen;
    // Require at least 0.75 similarity ratio for slight flexibility
    return sim >= 0.75 ? sim : 0;
  }

  return 0;
}
