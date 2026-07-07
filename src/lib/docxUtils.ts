import {
  AlignmentType,
  Document,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
import { DEFAULT_HOUSE_STYLE } from "./houseStyle";

const style = DEFAULT_HOUSE_STYLE;
const SIZE = style.fontSizePt * 2;

export function run(text: string, opts: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: style.font, size: SIZE, ...opts });
}

/** Wrap children in a house-styled A4 document with judicial margins. */
export function styledDoc(children: ISectionOptions["children"]): Document {
  return new Document({
    styles: { default: { document: { run: { font: style.font, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: style.margins,
          },
        },
        children,
      },
    ],
  });
}

export function heading(text: string, opts: { center?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 240, after: 160 },
    children: [run(text, { bold: true })],
  });
}

/** Minimal markdown → HTML for AI output (headings, bold, italics, lists). */
export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inList = false;
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (h) {
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (line.trim()) {
      html.push(`<p>${inline(line.trim())}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Convert stored rich text (Tiptap HTML) into docx paragraphs. Handles the
 * block/inline subset the app produces: p, h1-h3, ul/ol/li, br, strong, em;
 * annexure-reference spans are flattened to their current label text (PRD F8:
 * live references flatten to text on Word export).
 */
export function htmlToParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const blockRe = /<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(html))) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const runs = inlineRuns(inner, tag.startsWith("h"));
    if (runs.length === 0) continue;
    paragraphs.push(
      new Paragraph({
        alignment: tag.startsWith("h") ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        spacing: {
          line: Math.round(style.lineSpacing * 240),
          before: tag.startsWith("h") ? 240 : 0,
          after: 120,
        },
        bullet: tag === "li" ? { level: 0 } : undefined,
        children: runs,
      })
    );
  }

  if (paragraphs.length === 0 && html.trim()) {
    // plain text fallback
    for (const line of stripTags(html).split("\n")) {
      if (line.trim()) paragraphs.push(new Paragraph({ children: [run(line.trim())] }));
    }
  }
  return paragraphs;
}

function inlineRuns(inner: string, bold: boolean): TextRun[] {
  const runs: TextRun[] = [];
  // tokenize on strong/em boundaries; flatten all other tags (incl. spans)
  const tokenRe = /<(strong|b|em|i)[^>]*>([\s\S]*?)<\/\1>|([^<]+)|<[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(inner))) {
    if (m[1]) {
      const isBold = m[1] === "strong" || m[1] === "b";
      const text = decode(stripTags(m[2]));
      if (text) runs.push(run(text, { bold: bold || isBold, italics: !isBold }));
    } else if (m[3]) {
      const text = decode(m[3]);
      if (text.trim() || runs.length > 0) runs.push(run(text, { bold }));
    }
  }
  return runs;
}

function stripTags(s: string): string {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
