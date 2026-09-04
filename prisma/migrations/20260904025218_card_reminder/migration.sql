-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "remindAt" TIMESTAMP(3),
ADD COLUMN     "remindSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Card_remindAt_idx" ON "Card"("remindAt");
