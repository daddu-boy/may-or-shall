import type { CardTypeValue, DocTypeValue } from "./labels";

export interface HighlightRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MatterDto {
  id: string;
  title: string;
  kind: "CASE" | "PROJECT";
  court: string;
  caseNumber: string;
  parties: string;
  ourSide: "PETITIONER_PLAINTIFF" | "RESPONDENT_DEFENDANT" | "OTHER";
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  _count?: { documents: number; cards: number };
}

export interface DocumentDto {
  id: string;
  matterId: string;
  filename: string;
  docType: DocTypeValue;
  annexureLabel: string | null;
  pageCount: number;
  hasTextLayer: boolean;
  paraMap: { label: string; page: number; y: number }[];
  status: string;
  createdAt: string;
  _count?: { cards: number };
}

export interface CardDto {
  id: string;
  matterId: string;
  documentId: string | null;
  page: number | null;
  para: string | null;
  quote: string;
  rects: HighlightRect[];
  cardType: CardTypeValue;
  body: string;
  eventDate: string | null;
  tags: string[];
  pinned: boolean;
  citation: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  proposition: string | null;
  treatment: "RELIED_ON" | "DISTINGUISHED" | "OVERRULED_RISK" | null;
  orderIndex: number;
  createdAt: string;
  document?: { id: string; filename: string } | null;
}

export interface ChronologyEntryDto {
  id: string;
  matterId: string;
  eventDate: string;
  description: string;
  sourceCardId: string | null;
  includeInFiling: boolean;
  flaggedDuplicate?: boolean;
  sourceCard?: {
    id: string;
    page: number | null;
    para: string | null;
    documentId: string | null;
    document: { id: string; filename: string } | null;
  } | null;
}

/**
 * Token issued to the Word task pane by /addin/connect. In Word on the web the
 * pane is a cross-site iframe, so the session cookie is not sent — the token is
 * the fallback. On the desktop the cookie works and this stays empty.
 */
export const ADDIN_TOKEN_KEY = "mos.addinToken";

function addinToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ADDIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const token = addinToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & {
      status: number;
      body: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}
