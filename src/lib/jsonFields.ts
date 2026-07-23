/**
 * SQLite has no JSON columns or scalar lists, so paraMap / rects / tags /
 * linkedCardIds live in String columns holding JSON text. These helpers
 * (de)serialize at the API boundary so every client keeps receiving real
 * arrays — the DTO shapes in clientTypes are unchanged from the Postgres era.
 */

export type Rect = { page: number; x: number; y: number; w: number; h: number };
export type ParaMarker = { label: string; page: number; y: number };

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Card row -> API shape (rects/tags become arrays). */
export function cardOut<T extends { rects: string; tags: string }>(c: T) {
  return { ...c, rects: parseJson<Rect[]>(c.rects, []), tags: parseJson<string[]>(c.tags, []) };
}

/** Document row -> API shape (paraMap becomes an array). */
export function documentOut<T extends { paraMap: string }>(d: T) {
  return { ...d, paraMap: parseJson<ParaMarker[]>(d.paraMap, []) };
}

/** TraverseRow -> API shape (linkedCardIds becomes an array). */
export function rowOut<T extends { linkedCardIds: string }>(r: T) {
  return { ...r, linkedCardIds: parseJson<string[]>(r.linkedCardIds, []) };
}
