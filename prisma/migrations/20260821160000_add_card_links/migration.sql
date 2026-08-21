-- Links between two cards: a plaint paragraph and the annexure it refers to,
-- an admission and the document that contradicts it.

CREATE TABLE "CardLink" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "fromCardId" TEXT NOT NULL,
    "toCardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RELATES_TO',
    "note" TEXT NOT NULL DEFAULT '',
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardLink_fromCardId_toCardId_key" ON "CardLink"("fromCardId", "toCardId");
CREATE INDEX "CardLink_matterId_idx" ON "CardLink"("matterId");

ALTER TABLE "CardLink" ADD CONSTRAINT "CardLink_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardLink" ADD CONSTRAINT "CardLink_fromCardId_fkey" FOREIGN KEY ("fromCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardLink" ADD CONSTRAINT "CardLink_toCardId_fkey" FOREIGN KEY ("toCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
