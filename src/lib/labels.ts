/*
 * Personal note leads. It is the bucket you reach for when a passage does not
 * yet have a job, which is most passages on a first read, so it should be the
 * one under your thumb rather than the one at the bottom of the list.
 */
export const CARD_TYPES = [
  "MISC",
  "FACT",
  "DATE",
  "ISSUE",
  "OUR_ARGUMENT",
  "THEIR_ARGUMENT",
  "EVIDENCE",
  "CASE_LAW",
  "ADMISSION",
  "QUESTION",
] as const;

export type CardTypeValue = (typeof CARD_TYPES)[number];

export const CARD_TYPE_LABEL: Record<CardTypeValue, string> = {
  MISC: "Personal note",
  FACT: "Fact",
  DATE: "Date",
  ISSUE: "Issue",
  OUR_ARGUMENT: "Our argument",
  THEIR_ARGUMENT: "Their argument",
  EVIDENCE: "Evidence",
  CASE_LAW: "Case law",
  ADMISSION: "Admission",
  QUESTION: "Question",
};

/** Highlight + chip colours keyed to card type (tailwind-free hex so the PDF overlay can use them too). */
export const CARD_TYPE_COLOR: Record<CardTypeValue, string> = {
  MISC: "#6b7280",
  FACT: "#3b82f6",
  DATE: "#f59e0b",
  ISSUE: "#8b5cf6",
  OUR_ARGUMENT: "#10b981",
  THEIR_ARGUMENT: "#ef4444",
  EVIDENCE: "#06b6d4",
  CASE_LAW: "#d946ef",
  ADMISSION: "#84cc16",
  QUESTION: "#f97316",
};

/**
 * A case is litigation. A project is any other body of reading: a research
 * question, a policy brief, a manuscript. The distinction is a vocabulary and
 * a set of screens, never a difference in storage.
 */
export const MATTER_KINDS = ["CASE", "PROJECT"] as const;
export type MatterKind = (typeof MATTER_KINDS)[number];

export const MATTER_KIND_LABEL: Record<MatterKind, string> = {
  CASE: "Case",
  PROJECT: "Project",
};

export const MATTER_KIND_BLURB: Record<MatterKind, string> = {
  CASE: "Litigation. Court, case number, annexures, and a plaint to answer.",
  PROJECT: "Any other reading. Papers, reports, a manuscript, a brief.",
};

/**
 * The same stored card types, said in the language of the work. Our argument
 * and my claim are one idea; case law and a cited source are one idea. Only
 * the label moves, so a matter can change kind and every card survives.
 */
export const CARD_TYPE_LABEL_BY_KIND: Record<MatterKind, Record<CardTypeValue, string>> = {
  CASE: CARD_TYPE_LABEL,
  PROJECT: {
    MISC: "Personal note",
    FACT: "Fact",
    DATE: "Date",
    ISSUE: "Open question",
    OUR_ARGUMENT: "My claim",
    THEIR_ARGUMENT: "Opposing view",
    EVIDENCE: "Evidence",
    CASE_LAW: "Source",
    ADMISSION: "Concession",
    QUESTION: "Question",
  },
};

export function cardTypeLabel(type: CardTypeValue, kind: MatterKind = "CASE"): string {
  return CARD_TYPE_LABEL_BY_KIND[kind][type];
}

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

/**
 * How one card relates to another. Links join two cards rather than two raw
 * selections, so both ends already carry their citation (document, page,
 * paragraph) and survive into exports.
 */
export const LINK_KINDS = ["REFERS_TO", "SUPPORTS", "CONTRADICTS", "RELATES_TO"] as const;

export type LinkKindValue = (typeof LINK_KINDS)[number];

export const LINK_KIND_LABEL: Record<LinkKindValue, string> = {
  REFERS_TO: "Refers to",
  SUPPORTS: "Supports",
  CONTRADICTS: "Contradicts",
  RELATES_TO: "Relates to",
};

/** Wording for the reverse direction, so a link reads correctly from either end. */
export const LINK_KIND_INVERSE_LABEL: Record<LinkKindValue, string> = {
  REFERS_TO: "Referred to by",
  SUPPORTS: "Supported by",
  CONTRADICTS: "Contradicted by",
  RELATES_TO: "Relates to",
};
