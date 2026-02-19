/*
  Warnings:

  - A unique constraint covering the columns `[magicLinkToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "magicLinkExpiry" TIMESTAMP(3),
ADD COLUMN     "magicLinkToken" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_magicLinkToken_key" ON "User"("magicLinkToken");
