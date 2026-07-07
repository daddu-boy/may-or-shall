-- CreateEnum
CREATE TYPE "OurSide" AS ENUM ('PETITIONER_PLAINTIFF', 'RESPONDENT_DEFENDANT', 'OTHER');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('PLAINT', 'WRITTEN_STATEMENT', 'PETITION', 'REPLY', 'REJOINDER', 'JUDGMENT', 'ORDER', 'ANNEXURE', 'CORRESPONDENCE', 'MISC');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('FACT', 'DATE', 'ISSUE', 'OUR_ARGUMENT', 'THEIR_ARGUMENT', 'EVIDENCE', 'CASE_LAW', 'ADMISSION', 'QUESTION', 'MISC');

-- CreateEnum
CREATE TYPE "Treatment" AS ENUM ('RELIED_ON', 'DISTINGUISHED', 'OVERRULED_RISK');

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "court" TEXT NOT NULL DEFAULT '',
    "caseNumber" TEXT NOT NULL DEFAULT '',
    "parties" TEXT NOT NULL DEFAULT '',
    "ourSide" "OurSide" NOT NULL DEFAULT 'OTHER',
    "status" "MatterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "docType" "DocType" NOT NULL DEFAULT 'MISC',
    "annexureLabel" TEXT,
    "storagePath" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "hasTextLayer" BOOLEAN NOT NULL DEFAULT true,
    "paraMap" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "documentId" TEXT,
    "page" INTEGER,
    "para" TEXT,
    "quote" TEXT NOT NULL DEFAULT '',
    "rects" JSONB NOT NULL DEFAULT '[]',
    "cardType" "CardType" NOT NULL DEFAULT 'MISC',
    "body" TEXT NOT NULL DEFAULT '',
    "eventDate" DATE,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "citation" TEXT,
    "proposition" TEXT,
    "treatment" "Treatment",
    "orderIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronologyEntry" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "sourceCardId" TEXT,
    "includeInFiling" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "ChronologyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_matterId_idx" ON "Document"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_documentId_page_key" ON "DocumentPage"("documentId", "page");

-- CreateIndex
CREATE INDEX "Card_matterId_cardType_idx" ON "Card"("matterId", "cardType");

-- CreateIndex
CREATE INDEX "Card_documentId_idx" ON "Card"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChronologyEntry_sourceCardId_key" ON "ChronologyEntry"("sourceCardId");

-- CreateIndex
CREATE INDEX "ChronologyEntry_matterId_eventDate_idx" ON "ChronologyEntry"("matterId", "eventDate");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronologyEntry" ADD CONSTRAINT "ChronologyEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronologyEntry" ADD CONSTRAINT "ChronologyEntry_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
