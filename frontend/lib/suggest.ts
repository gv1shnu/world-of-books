/**
 * "Did you mean" suggestions for mistyped category names or slugs.
 *
 * Scores each category by edit distance against both its title and slug
 * (ignoring case, punctuation and the "-books" suffix) and reports whether
 * the best match is close enough to correct automatically, the way a search
 * engine says "Showing results for ...".
 */

export interface Suggestable {
  slug: string;
  title: string;
}

export interface SuggestionResult<T extends Suggestable> {
  /** Closest categories, best first. Empty when nothing is reasonably close. */
  suggestions: T[];
  /** True when the best suggestion is a clear, near-exact match. */
  confident: boolean;
}

export const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[-_]+books?$/, '')
    .replace(/\bbooks?\b/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

/**
 * Scores run from 0 (identical) to 1 (nothing in common). `typo` uses edit
 * distance only; `rank` also rewards prefix/substring matches, which make good
 * suggestions but are not certain enough to auto-correct ("hor" -> "Horror"?).
 */
function score(query: string, candidate: Suggestable) {
  let typo = 1;
  let rank = 1;
  for (const raw of [candidate.slug, candidate.title]) {
    const target = normalize(raw);
    if (!target) continue;
    const distance = editDistance(query, target) / Math.max(query.length, target.length);
    const partial = target.startsWith(query) || query.startsWith(target) ? 0.15 : target.includes(query) ? 0.25 : 1;
    typo = Math.min(typo, distance);
    rank = Math.min(rank, distance, partial);
  }
  return { typo, rank };
}

export function suggestCategories<T extends Suggestable>(
  input: string,
  categories: T[],
  limit = 3,
): SuggestionResult<T> {
  const query = normalize(input);
  if (!query) return { suggestions: [], confident: false };

  const seen = new Set<string>();
  const ranked = categories
    .filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)))
    .map((c) => ({ c, ...score(query, c) }))
    .filter(({ rank }) => rank <= 0.45)
    .sort((a, b) => a.rank - b.rank);

  const [first, second] = ranked;
  const confident =
    !!first && first.typo <= 0.2 && (!second || second.typo - first.typo >= 0.1);
  return { suggestions: ranked.slice(0, limit).map(({ c }) => c), confident };
}
