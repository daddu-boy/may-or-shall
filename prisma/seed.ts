import { PrismaClient } from "@prisma/client";
import { extractPdf } from "../src/lib/pdf/extract";
import { storage } from "../src/lib/storage";
import { syncCardChronology } from "../src/lib/chronology";
import { makeJudgmentPdf, makePlaintPdf } from "./samplePdfs";

const prisma = new PrismaClient();

async function ingest(matterId: string, filename: string, docType: "PLAINT" | "JUDGMENT", pdf: Buffer) {
  const extraction = await extractPdf(pdf);
  const doc = await prisma.document.create({
    data: {
      matterId,
      filename,
      docType,
      storagePath: "",
      pageCount: extraction.pageCount,
      hasTextLayer: extraction.hasTextLayer,
      paraMap: extraction.paraMap as object[],
    },
  });
  const storagePath = `documents/${doc.id}.pdf`;
  await storage.put(storagePath, pdf);
  await prisma.document.update({ where: { id: doc.id }, data: { storagePath } });
  await prisma.documentPage.createMany({
    data: extraction.pageTexts.map((text, i) => ({ documentId: doc.id, page: i + 1, text })),
  });
  return doc;
}

async function main() {
  const existing = await prisma.matter.findFirst({
    where: { title: "Sharma Infra Projects v. National Buildcon" },
  });
  if (existing) {
    console.log("Seed matter already exists, skipping.");
    return;
  }

  const matter = await prisma.matter.create({
    data: {
      title: "Sharma Infra Projects v. National Buildcon",
      court: "Delhi High Court",
      caseNumber: "CS(COMM) 412/2024",
      parties: "Sharma Infra Projects Pvt Ltd v. National Buildcon Ltd",
      ourSide: "PETITIONER_PLAINTIFF",
    },
  });

  const plaint = await ingest(matter.id, "Plaint - CS(COMM) 412 of 2024.pdf", "PLAINT", await makePlaintPdf());
  await ingest(matter.id, "ABC Constructions v State - 2023 INSC 411.pdf", "JUDGMENT", await makeJudgmentPdf());

  // A few starter cards on the plaint so the board and chronology have content.
  const mkCard = async (data: {
    cardType: "FACT" | "DATE" | "ADMISSION";
    body: string;
    quote: string;
    page: number;
    para: string;
    eventDate?: string;
    y: number;
  }) => {
    const card = await prisma.card.create({
      data: {
        matterId: matter.id,
        documentId: plaint.id,
        page: data.page,
        para: data.para,
        quote: data.quote,
        rects: [{ page: data.page, x: 0.12, y: data.y, w: 0.76, h: 0.02 }],
        cardType: data.cardType,
        body: data.body,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        orderIndex: 1,
      },
    });
    await syncCardChronology(card.id);
  };

  await mkCard({
    cardType: "DATE",
    body: "Letter of Intent awarding civil works package (Rs. 42.5 cr) issued by Defendant",
    quote: "By a Letter of Intent dated 12.03.2021, the Defendant awarded to the Plaintiff the civil works package",
    page: 1,
    para: "3",
    eventDate: "2021-03-12",
    y: 0.32,
  });
  await mkCard({
    cardType: "DATE",
    body: "Works Contract executed; 24-month completion period",
    quote: "The parties executed a formal Works Contract on 05.04.2021",
    page: 1,
    para: "4",
    eventDate: "2021-04-05",
    y: 0.4,
  });
  await mkCard({
    cardType: "ADMISSION",
    body: "Defendant admitted execution of works under RA-6 and RA-7 and pleaded liquidity crunch",
    quote: "the Defendant admitted that the works under bills RA-6 and RA-7 had been duly executed",
    page: 1,
    para: "8",
    y: 0.68,
  });

  console.log(`Seeded matter ${matter.id} with 2 documents and 3 cards.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
