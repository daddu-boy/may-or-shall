/**
 * Paragraph detection over extracted PDF lines, per PRD F2.
 *
 * A ParaMarker records where a numbered paragraph begins: its label, the page
 * it appears on (1-based) and the normalized top-based y position (0 = top of
 * page, 1 = bottom). Cards resolve their paragraph number by finding the last
 * marker at or above the highlight position.
 */

export interface ExtractedLine {
  text: string;
  /** normalized left edge of the line, 0..1 */
  x: number;
  /** normalized top-based y of the line, 0..1 */
  y: number;
}

export interface ParaMarker {
  label: string;
  page: number;
  y: number;
}

const MARKER_PATTERNS: { re: RegExp; label: (m: RegExpMatchArray) => string }[] = [
  // "12." or "12)"  — arabic numbered paragraphs
  { re: /^(\d{1,3})\s*[.)]\s+\S/, label: (m) => m[1] },
  // "(i)" "(iv)" — lower roman in parentheses
  { re: /^\(([ivxlcdm]{1,7})\)\s+\S/, label: (m) => `(${m[1]})` },
  // "(a)" — lower alpha in parentheses
  { re: /^\(([a-z])\)\s+\S/, label: (m) => `(${m[1]})` },
  // "XII." — upper roman with dot
  { re: /^([IVXLCDM]{1,7})\.\s+\S/, label: (m) => m[1] },
];

/** Lines must begin in the left portion of the page to count as a paragraph start. */
const LEFT_MARGIN_MAX_X = 0.25;

export function detectParaMarkers(pages: ExtractedLine[][]): ParaMarker[] {
  const markers: ParaMarker[] = [];
  pages.forEach((lines, i) => {
    for (const line of lines) {
      if (line.x > LEFT_MARGIN_MAX_X) continue;
      const text = line.text.trimStart();
      for (const { re, label } of MARKER_PATTERNS) {
        const m = text.match(re);
        if (m) {
          markers.push({ label: label(m), page: i + 1, y: line.y });
          break;
        }
      }
    }
  });
  return markers;
}

/**
 * Resolve the paragraph a highlight falls in: the last marker at or before
 * (page, yTop) in reading order. Returns null when nothing precedes it.
 */
export function resolvePara(markers: ParaMarker[], page: number, yTop: number): string | null {
  // Marker y is the text baseline; highlight rect tops sit roughly one glyph
  // ascent above it, so allow ~0.02 of page height of slack.
  const EPSILON = 0.02;
  let found: string | null = null;
  for (const m of markers) {
    if (m.page > page || (m.page === page && m.y > yTop + EPSILON)) break;
    found = m.label;
  }
  return found;
}
