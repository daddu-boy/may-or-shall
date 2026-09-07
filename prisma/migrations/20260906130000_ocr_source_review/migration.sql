ALTER TABLE "Document" ADD COLUMN "originalStoragePath" TEXT;
ALTER TABLE "Document" ADD COLUMN "extractionReport" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "GeneratedArtefact" ADD COLUMN "sourceReview" TEXT NOT NULL DEFAULT '{}';
