export const CARD_TYPES = [
  "FACT",
  "DATE",
  "ISSUE",
  "OUR_ARGUMENT",
  "THEIR_ARGUMENT",
  "EVIDENCE",
  "CASE_LAW",
  "ADMISSION",
  "QUESTION",
  "MISC",
] as const;

export type CardTypeValue = (typeof CARD_TYPES)[number];

export const CARD_TYPE_LABEL: Record<CardTypeValue, string> = {
  FACT: "Fact",
  DATE: "Date",
  ISSUE: "Issue",
  OUR_ARGUMENT: "Our argument",
  THEIR_ARGUMENT: "Their argument",
  EVIDENCE: "Evidence",
  CASE_LAW: "Case law",
  ADMISSION: "Admission",
  QUESTION: "Question",
  MISC: "Misc",
};

/** Highlight + chip colours keyed to card type (tailwind-free hex so the PDF overlay can use them too). */
export const CARD_TYPE_COLOR: Record<CardTypeValue, string> = {
  FACT: "#3b82f6",
  DATE: "#f59e0b",
  ISSUE: "#8b5cf6",
  OUR_ARGUMENT: "#10b981",
  THEIR_ARGUMENT: "#ef4444",
  EVIDENCE: "#06b6d4",
  CASE_LAW: "#d946ef",
  ADMISSION: "#84cc16",
  QUESTION: "#f97316",
  MISC: "#6b7280",
};

export const DOC_TYPES = [
  "PLAINT",
  "WRITTEN_STATEMENT",
  "PETITION",
  "REPLY",
  "REJOINDER",
  "JUDGMENT",
  "ORDER",
  "ANNEXURE",
  "CORRESPONDENCE",
  "MISC",
] as const;

export type DocTypeValue = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABEL: Record<DocTypeValue, string> = {
  PLAINT: "Plaint",
  WRITTEN_STATEMENT: "Written statement",
  PETITION: "Petition",
  REPLY: "Reply",
  REJOINDER: "Rejoinder",
  JUDGMENT: "Judgment",
  ORDER: "Order",
  ANNEXURE: "Annexure",
  CORRESPONDENCE: "Correspondence",
  MISC: "Misc",
};

export const OUR_SIDES = ["PETITIONER_PLAINTIFF", "RESPONDENT_DEFENDANT", "OTHER"] as const;

export const OUR_SIDE_LABEL: Record<(typeof OUR_SIDES)[number], string> = {
  PETITIONER_PLAINTIFF: "Petitioner / Plaintiff",
  RESPONDENT_DEFENDANT: "Respondent / Defendant",
  OTHER: "Other",
};
