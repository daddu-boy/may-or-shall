-- CreateEnum
CREATE TYPE "TraverseStatus" AS ENUM ('NOT_STARTED', 'DENIED_BARE', 'DENIED_SPECIFIC', 'ADMITTED', 'ADMITTED_PARTLY', 'LEGAL_OBJECTION');

-- CreateEnum
CREATE TYPE "ArtefactType" AS ENUM ('SENIOR_BRIEF', 'WRITTEN_SUBMISSIONS', 'JUDGE_NOTE', 'LIST_OF_DATES', 'CONVENIENCE_COMPILATION', 'WRITTEN_STATEMENT_DRAFT');

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "annexurePrefix" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "TraverseSheet" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "TraverseSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraverseRow" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "paraNo" TEXT NOT NULL,
    "paraText" TEXT NOT NULL,
    "responseText" TEXT NOT NULL DEFAULT '',
    "status" "TraverseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "linkedCardIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraverseRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedArtefact" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "artefactType" "ArtefactType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "promptSnapshot" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'local',

    CONSTRAINT "GeneratedArtefact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnexureItem" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnexureItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TraverseSheet_matterId_key" ON "TraverseSheet"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "TraverseRow_sheetId_order_key" ON "TraverseRow"("sheetId", "order");

-- CreateIndex
CREATE INDEX "GeneratedArtefact_matterId_artefactType_idx" ON "GeneratedArtefact"("matterId", "artefactType");

-- CreateIndex
CREATE UNIQUE INDEX "AnnexureItem_documentId_key" ON "AnnexureItem"("documentId");

-- CreateIndex
CREATE INDEX "AnnexureItem_matterId_position_idx" ON "AnnexureItem"("matterId", "position");

-- AddForeignKey
ALTER TABLE "TraverseSheet" ADD CONSTRAINT "TraverseSheet_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraverseRow" ADD CONSTRAINT "TraverseRow_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "TraverseSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedArtefact" ADD CONSTRAINT "GeneratedArtefact_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnexureItem" ADD CONSTRAINT "AnnexureItem_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
