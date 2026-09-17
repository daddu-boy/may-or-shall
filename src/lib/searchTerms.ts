/**
 * Word matching for the connector's search.
 *
 * Search used to test whether a card contained the whole query as one exact
 * string, so "termination delay" found nothing unless a card said exactly that.
 * This splits the query into words, reduces each to a rough stem so that
 * "terminated" and "termination" meet, tolerates a single typo in longer words,
 * and ranks by how many of the words a card contains.
 *
 * It deliberately does no meaning matching of its own. When words find little,
 * the caller hands the model a wider set of cards and lets it judge by meaning,
 * which it is already good at, rather than this code guessing.
 */

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "onto", "about",
  "any", "all", "are", "was", "were", "has", "have", "had", "not", "but", "its",
  "our", "their", "there", "which", "what", "when", "where", "who", "whom",
  "why", "how", "can", "could", "would", "should", "will", "shall", "may",
  "might", "must", "been", "being", "than", "then", "them", "they", "you",
  "your", "his", "her", "him", "she", "out", "over", "under", "also", "such",
  "some", "more", "most", "very", "just", "only", "into", "upon", "each",
  "find", "show", "give", "tell", "search", "anything", "something", "everything",
  "card", "cards", "matter", "matters", "note", "notes",
]);

const SUFFIXES = [
  "ations", "ation", "ments", "ment", "ness", "ities", "ity", "ings", "ing",
  "ated", "ates", "ate", "ies", "ied", "ers", "er", "ed", "es", "ly", "al", "s",
];

/** A rough stem. Only ever used for containment, so rough is enough. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The distinct, stemmed words of a query worth matching on, at most eight. */
export function queryTerms(query: string): string[] {
  const out: string[] = [];
  for (const w of words(query)) {
    if (w.length < 3 || STOP.has(w)) continue;
    // keep numbers whole: "412", "2021", "14.2" are identifiers, not stems
    const t = /\d/.test(w) ? w : stem(w);
    if (!out.includes(t)) out.push(t);
    if (out.length === 8) break;
  }
  return out;
}

/** Levenshtein distance, giving up as soon as it passes the limit. */
function within(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (cur[j] < best) best = cur[j];
    }
    if (best > limit) return false;
    prev = cur;
  }
  return prev[b.length] <= limit;
}

export interface Score {
  /** higher is better; zero means no word matched */
  score: number;
  /** how many of the query's words were found */
  matched: number;
}

/**
 * Score a piece of text against the query's terms. A word counts fully when it
 * begins with the term's stem, and at a discount when it is one typo away. The
 * whole query appearing verbatim earns a bonus, so exact phrases still lead.
 */
export function scoreText(text: string, terms: string[], phrase: string): Score {
  if (!terms.length || !text) return { score: 0, matched: 0 };
  const ws = words(text);
  const stems = ws.map((w) => (/\d/.test(w) ? w : stem(w)));
  let score = 0;
  let matched = 0;
  for (const t of terms) {
    let hit = 0;
    for (let i = 0; i < ws.length; i++) {
      if (ws[i].startsWith(t) || stems[i] === t) {
        hit = 1;
        break;
      }
      if (
        !hit &&
        t.length >= 5 &&
        !/\d/.test(t) &&
        (within(stems[i], t, 1) || within(ws[i], t, 1) || within(stem(t), stems[i], 1))
      ) {
        hit = 0.7;
      }
    }
    if (hit) {
      score += hit;
      matched++;
    }
  }
  if (matched && phrase.length >= 3 && text.toLowerCase().includes(phrase.toLowerCase())) {
    score += 2;
  }
  return { score, matched };
}

/** Where in the text the first term appears, for building a snippet. */
export function firstHit(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let best = -1;
  for (const t of terms) {
    const at = lower.indexOf(t);
    if (at >= 0 && (best < 0 || at < best)) best = at;
  }
  return best;
}
