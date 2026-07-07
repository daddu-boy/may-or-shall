const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Best-effort extraction of the first date in a highlight, favouring Indian
 * legal drafting conventions (dd.mm.yyyy, "12th March, 2021"). Returns
 * YYYY-MM-DD or null; only used to prefill the Date-card input, never
 * auto-committed.
 */
export function extractDate(text: string): string | null {
  // dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy
  let m = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (m) {
    const r = iso(+m[3], +m[2], +m[1]);
    if (r) return r;
  }
  // yyyy-mm-dd
  m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) {
    const r = iso(+m[1], +m[2], +m[3]);
    if (r) return r;
  }
  // "12th March, 2021" / "12 March 2021"
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const r = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (r) return r;
  }
  // "March 12, 2021"
  m = text.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    const r = iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    if (r) return r;
  }
  return null;
}
