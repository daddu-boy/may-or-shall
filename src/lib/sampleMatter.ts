import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./db";
import { storage } from "./storage";
import type { ParaMarker } from "./pdf/paraMap";

/**
 * A worked example seeded into every new account.
 *
 * A first-time user otherwise lands on an empty workspace, where nothing can be
 * demonstrated and nothing can be clicked — and a store reviewer has nothing to
 * insert into a document. So we generate a short plaint as a real PDF, ingest it
 * the way an upload would (pages + paragraph map), and hang a handful of cards
 * off it. Everything downstream (chronology, traverse, compilation, export) then
 * has something to work with on day one.
 *
 * It is an ordinary matter: the user can delete it in one click.
 */

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 64;
const LEADING = 17;

type Para = { label: string; text: string };

const TITLE = [
  "IN THE HIGH COURT OF DELHI AT NEW DELHI",
  "CS(COMM) 412 of 2026",
  "Sharma Infra Projects Pvt. Ltd.  ...Plaintiff",
  "versus",
  "National Buildcon Ltd.  ...Defendant",
  "PLAINT",
];

const PARAS: Para[] = [
  { label: "1", text: "1. The Plaintiff is a company incorporated under the Companies Act, 2013, engaged in the business of civil construction, and is the contractor under the Works Contract dated 15.03.2021 which is the subject matter of the present suit." },
  { label: "2", text: "2. On 12.03.2021 the Defendant issued a Letter of Intent awarding the civil works package for a total consideration of Rs. 42.5 crore, and the Works Contract was thereafter executed on 15.03.2021 providing for a completion period of 24 months." },
  { label: "3", text: "3. The Plaintiff mobilised its resources and commenced work at the site on 20.04.2021, and continued to execute the works in accordance with the drawings and instructions issued by the Defendant's engineer from time to time." },
  { label: "4", text: "4. Running account bills RA-1 to RA-7 were submitted by the Plaintiff and were duly certified by the Defendant's engineer without protest or qualification of any nature whatsoever." },
  { label: "5", text: "5. It is settled law that certification of a running account bill by the employer's engineer constitutes an admission of the execution and measurement of the works, and the burden lies heavily on the employer to displace such admission." },
  { label: "6", text: "6. Despite such certification, no payment was made against RA-6 and RA-7, and by letter dated 11.04.2022 the Defendant purported to terminate the contract alleging delay on the part of the Plaintiff, which allegation is denied." },
  { label: "7", text: "7. The termination is illegal, contrary to Clause 14.2 of the Works Contract, and was effected without the notice and cure period mandated thereunder." },
  { label: "8", text: "8. The Plaintiff is accordingly entitled to a decree for the sum of Rs. 8.74 crore together with interest, and to damages for the unexpired portion of the contract." },
];

function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the plaint and returns the PDF plus the paragraph map it implies. */
async function buildPlaint(): Promise<{
  bytes: Uint8Array;
  paraMap: ParaMarker[];
  pageTexts: string[];
}> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const maxW = A4.w - MARGIN * 2;

  const paraMap: ParaMarker[] = [];
  const pageTexts: string[] = [];
  let page = pdf.addPage([A4.w, A4.h]);
  let pageNo = 1;
  let text = "";
  let y = A4.h - MARGIN;

  const newPage = () => {
    pageTexts.push(text.trim());
    text = "";
    page = pdf.addPage([A4.w, A4.h]);
    pageNo += 1;
    y = A4.h - MARGIN;
  };

  for (const [i, line] of TITLE.entries()) {
    const f = i === 0 || i === TITLE.length - 1 ? bold : font;
    const size = i === 0 ? 13 : 11.5;
    page.drawText(line, {
      x: (A4.w - f.widthOfTextAtSize(line, size)) / 2,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.1),
    });
    text += line + "\n";
    y -= i === TITLE.length - 1 ? LEADING * 2 : LEADING * 1.4;
  }

  for (const para of PARAS) {
    const lines = wrap(para.text, font, 11.5, maxW);
    if (y - lines.length * LEADING < MARGIN + 40) newPage();
    // the marker sits where the paragraph starts, normalised from the top
    paraMap.push({ label: para.label, page: pageNo, y: (A4.h - y) / A4.h });
    for (const l of lines) {
      page.drawText(l, { x: MARGIN, y, size: 11.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= LEADING;
    }
    text += para.text + "\n";
    y -= LEADING * 0.6;
  }
  pageTexts.push(text.trim());

  return { bytes: await pdf.save(), paraMap, pageTexts };
}

/** Cards that point at real paragraphs of the generated plaint. */
const CARDS: {
  cardType: string;
  para: string;
  page: number;
  quote: string;
  body: string;
  eventDate?: string;
  tags?: string[];
}[] = [
  {
    cardType: "DATE",
    para: "2",
    page: 1,
    quote: "Letter of Intent awarding the civil works package for a total consideration of Rs. 42.5 crore",
    body: "Letter of Intent issued awarding the civil works package (Rs. 42.5 cr).",
    eventDate: "2021-03-12",
    tags: ["timeline"],
  },
  {
    cardType: "DATE",
    para: "2",
    page: 1,
    quote: "the Works Contract was thereafter executed on 15.03.2021 providing for a completion period of 24 months",
    body: "Works Contract executed; 24-month completion period.",
    eventDate: "2021-03-15",
    tags: ["timeline"],
  },
  {
    cardType: "FACT",
    para: "3",
    page: 1,
    quote: "The Plaintiff mobilised its resources and commenced work at the site on 20.04.2021",
    body: "Plaintiff commenced work at site on 20.04.2021.",
    eventDate: "2021-04-20",
  },
  {
    cardType: "ADMISSION",
    para: "4",
    page: 1,
    quote: "duly certified by the Defendant's engineer without protest or qualification of any nature whatsoever",
    body: "RA-1 to RA-7 certified by the Defendant's own engineer, without protest.",
    tags: ["key"],
  },
  {
    cardType: "CASE_LAW",
    para: "5",
    page: 1,
    quote: "certification of a running account bill by the employer's engineer constitutes an admission of the execution and measurement of the works",
    body: "Certification of an RA bill is an admission of execution and measurement; burden shifts to the employer.",
    tags: ["key"],
  },
  {
    cardType: "THEIR_ARGUMENT",
    para: "6",
    page: 1,
    quote: "purported to terminate the contract alleging delay on the part of the Plaintiff",
    body: "Defendant terminated on 11.04.2022 alleging delay.",
    eventDate: "2022-04-11",
  },
  {
    cardType: "OUR_ARGUMENT",
    para: "7",
    page: 1,
    quote: "contrary to Clause 14.2 of the Works Contract, and was effected without the notice and cure period mandated thereunder",
    body: "Termination is illegal: no notice or cure period under Clause 14.2.",
  },
];

export async function createSampleMatter(userId: string): Promise<string | null> {
  try {
    const { bytes, paraMap, pageTexts } = await buildPlaint();

    const matter = await prisma.matter.create({
      data: {
        userId,
        title: "Sample: Sharma Infra Projects v. National Buildcon",
        court: "High Court of Delhi",
        caseNumber: "CS(COMM) 412 of 2026",
        parties: "Sharma Infra Projects Pvt. Ltd. v. National Buildcon Ltd.",
        ourSide: "PETITIONER_PLAINTIFF",
      },
    });

    const doc = await prisma.document.create({
      data: {
        matterId: matter.id,
        filename: "Plaint - CS(COMM) 412 of 2026.pdf",
        docType: "PLAINT",
        storagePath: "",
        pageCount: pageTexts.length,
        hasTextLayer: true,
        paraMap: JSON.stringify(paraMap),
        status: "ready",
      },
    });

    const storagePath = `documents/${doc.id}.pdf`;
    await storage.put(storagePath, Buffer.from(bytes));
    await prisma.document.update({ where: { id: doc.id }, data: { storagePath } });

    await prisma.documentPage.createMany({
      data: pageTexts.map((text, i) => ({ documentId: doc.id, page: i + 1, text })),
    });

    for (const [i, c] of CARDS.entries()) {
      const marker = paraMap.find((m) => m.label === c.para);
      await prisma.card.create({
        data: {
          matterId: matter.id,
          documentId: doc.id,
          page: c.page,
          para: c.para,
          quote: c.quote,
          body: c.body,
          cardType: c.cardType,
          eventDate: c.eventDate ? new Date(c.eventDate) : null,
          tags: JSON.stringify(c.tags ?? []),
          orderIndex: i,
          // a light highlight box roughly where the paragraph sits, so the
          // reader has something to paint on open
          rects: JSON.stringify(
            marker ? [{ page: c.page, x: 0.1, y: marker.y, w: 0.8, h: 0.02 }] : []
          ),
          createdBy: "sample",
        },
      });
    }

    /*
     * Designate the plaint, so the traverse sheet exists from the first
     * moment. Without it the deemed admission guard, which is the most
     * distinctive thing this app does, answers "designate a plaint first" to
     * anyone who tries it, including a reviewer following our own example.
     * Two paragraphs are answered and the rest are left open, so the guard has
     * something true to report rather than a blank sheet.
     */
    const { splitPlaintParas } = await import("./paraSplit");
    const pages = await prisma.documentPage.findMany({
      where: { documentId: doc.id },
      orderBy: { page: "asc" },
      select: { text: true },
    });
    const paras = splitPlaintParas(pages.map((p) => p.text));
    if (paras.length > 0) {
      await prisma.traverseSheet.create({
        data: {
          matterId: matter.id,
          documentId: doc.id,
          createdBy: "sample",
          rows: {
            create: paras.map((para, i) => ({
              order: i + 1,
              paraNo: String(para.no),
              paraText: para.text,
              ...(i === 0
                ? {
                    status: "ADMITTED",
                    responseText:
                      "<p>The execution of the works contract dated 15.03.2021 is admitted.</p>",
                  }
                : i === 1
                  ? {
                      status: "DENIED_SPECIFIC",
                      responseText:
                        "<p>Denied. The bills at RA-1 to RA-8 were certified by the Defendant's own engineer, as borne out by the record.</p>",
                    }
                  : {}),
            })),
          },
        },
      });
    }

    // Date cards drive the chronology, exactly as they would for a real matter
    const { syncCardChronology } = await import("./chronology");
    const dated = await prisma.card.findMany({
      where: { matterId: matter.id, eventDate: { not: null } },
    });
    for (const card of dated) await syncCardChronology(card.id);

    return matter.id;
  } catch {
    // never block sign-in because the example failed to build
    return null;
  }
}
