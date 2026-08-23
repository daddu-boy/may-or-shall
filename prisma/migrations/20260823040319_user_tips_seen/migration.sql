-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tipsSeen" TEXT[] DEFAULT ARRAY[]::TEXT[];
