import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 72;
const LINE = 20;

async function makePdf(title: string, paragraphs: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const maxWidth = A4.w - MARGIN * 2;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const newPageIfNeeded = () => {
    if (y < MARGIN + LINE) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  const wrap = (text: string, f = font, size = 12): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // centred title
  for (const line of wrap(title, bold, 13)) {
    newPageIfNeeded();
    const w = bold.widthOfTextAtSize(line, 13);
    page.drawText(line, { x: (A4.w - w) / 2, y, size: 13, font: bold, color: rgb(0, 0, 0) });
    y -= LINE * 1.5;
  }
  y -= LINE;

  paragraphs.forEach((para, i) => {
    const numbered = `${i + 1}. ${para}`;
    for (const line of wrap(numbered)) {
      newPageIfNeeded();
      page.drawText(line, { x: MARGIN, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= LINE;
    }
    y -= LINE * 0.6;
  });

  return Buffer.from(await doc.save());
}

export async function makePlaintPdf(): Promise<Buffer> {
  return makePdf(
    "IN THE HIGH COURT OF DELHI AT NEW DELHI — CS(COMM) 412/2024 — SHARMA INFRA PROJECTS PVT LTD v. NATIONAL BUILDCON LTD — PLAINT",
    [
      "The Plaintiff is a company incorporated under the Companies Act, 2013, engaged in the business of civil and infrastructure construction, having its registered office at Nehru Place, New Delhi.",
      "The Defendant is a public limited company engaged in real estate development, which engaged the Plaintiff as works contractor for its township project at Sector 150, Noida.",
      "By a Letter of Intent dated 12.03.2021, the Defendant awarded to the Plaintiff the civil works package for the said project for a total consideration of Rs. 42,50,00,000.",
      "The parties executed a formal Works Contract on 05.04.2021, which incorporated the tender conditions and provided for completion of the works within 24 months.",
      "The Plaintiff mobilised its resources and commenced work at the site on 20.04.2021, which fact is recorded in the minutes of the first project review meeting.",
      "Between April 2021 and December 2021, the Plaintiff raised running account bills numbered RA-1 to RA-8, all of which were certified by the Defendant's engineer without demur.",
      "The Defendant failed to release payment against bills RA-6 to RA-8 despite certification, and by letter dated 18.01.2022 the Plaintiff called upon the Defendant to release the outstanding amount of Rs. 6,72,00,000.",
      "By its reply dated 02.02.2022, the Defendant admitted that the works under bills RA-6 and RA-7 had been duly executed, but pleaded a temporary liquidity crunch and sought time until 31.03.2022 to make payment.",
      "No payment was made by 31.03.2022. Instead, by letter dated 11.04.2022, the Defendant purported to terminate the contract alleging delay on the part of the Plaintiff, which allegation is false and an afterthought.",
      "The termination is illegal, contrary to the terms of the Works Contract, and was effected without issuing the mandatory 30-day cure notice required under Clause 14.2 of the contract.",
      "The Plaintiff has suffered losses on account of unpaid certified bills, retention money wrongfully withheld, and idle machinery charges, cumulatively quantified at Rs. 9,84,00,000 as per the particulars annexed hereto.",
      "The cause of action arose on 18.01.2022 when payment was first demanded, on 02.02.2022 when liability was admitted, and finally on 11.04.2022 when the contract was illegally terminated. This Court has territorial jurisdiction as the contract was executed at New Delhi.",
    ]
  );
}

export async function makeJudgmentPdf(): Promise<Buffer> {
  return makePdf(
    "SUPREME COURT OF INDIA — M/S ABC CONSTRUCTIONS v. STATE OF NCT OF DELHI — 2023 INSC 411 — JUDGMENT",
    [
      "This appeal arises out of a judgment of the High Court of Delhi dismissing the appellant's suit for recovery of amounts due under a works contract on the ground of delay attributable to the contractor.",
      "The short question that falls for consideration is whether an employer who has certified running account bills without protest can subsequently dispute the quality or quantum of the works covered by such bills.",
      "It is settled law that certification of a running account bill by the employer's engineer constitutes an admission of the execution and measurement of the works, and the burden lies heavily on the employer to displace such admission.",
      "In State of Kerala v. Bhaskaran, this Court held that a termination effected without complying with a contractual cure notice provision is bad in law, and the contractor is entitled to damages for the unexpired period of the contract.",
      "We are of the view that the High Court erred in placing the burden of proof upon the contractor despite the admitted certification of bills RA-1 to RA-8 by the employer's engineer on record.",
      "Where the employer admits liability in correspondence and seeks time for payment, a subsequent plea of defective work is an afterthought and cannot be countenanced unless supported by contemporaneous record.",
      "The appeal is accordingly allowed. The judgment of the High Court is set aside and the suit is decreed with interest at 9 percent per annum from the date of institution until realisation.",
    ]
  );
}
