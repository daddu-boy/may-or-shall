/**
 * Split an ingested plaint into numbered paragraphs for the traverse sheet
 * (PRD F5). Works over the per-page text extracted at ingestion: paragraphs
 * are detected as lines starting with the next sequential arabic number
 * ("1.", "2)", ...), which avoids false positives from dates or amounts.
 */

export interface PlaintPara {
  no: number;
  text: string;
  page: number;
}

export function splitPlaintParas(pageTexts: string[]): PlaintPara[] {
  const paras: PlaintPara[] = [];
  let current: PlaintPara | null = null;
  let expected = 1;

  for (let p = 0; p < pageTexts.length; p++) {
    for (const rawLine of pageTexts[p].split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(/^(\d{1,3})\s*[.)]\s+(.*)/);
      if (m && parseInt(m[1], 10) === expected) {
        if (current) paras.push(current);
        current = { no: expected, text: m[2].trim(), page: p + 1 };
        expected++;
      } else if (current) {
        current.text += ` ${line}`;
      }
    }
  }
  if (current) paras.push(current);
  return paras;
}
