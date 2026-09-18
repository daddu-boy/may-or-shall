CREATE TABLE "CardCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardCategory_userId_key_key" ON "CardCategory"("userId", "key");
CREATE INDEX "CardCategory_userId_idx" ON "CardCategory"("userId");
ALTER TABLE "CardCategory" ADD CONSTRAINT "CardCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
