/**
 * House style constants for all Word exports (PRD F9).
 * A4 with judicial margins by default; per-court overrides live here.
 */
export interface HouseStyle {
  font: string;
  /** point size for body text in court filings */
  fontSizePt: number;
  lineSpacing: number;
  /** margins in twips (1440 = 1 inch) */
  margins: { top: number; bottom: number; left: number; right: number };
}

export const DEFAULT_HOUSE_STYLE: HouseStyle = {
  font: "Times New Roman",
  fontSizePt: 14,
  lineSpacing: 1.5,
  // judicial margins: generous left for binding
  margins: { top: 1440, bottom: 1440, left: 2160, right: 1440 },
};
