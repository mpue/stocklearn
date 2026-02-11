/*
  Warnings:

  - You are about to drop the column `userId` on the `Game` table. All the data in the column will be lost.
  - Added the required column `whitePlayerId` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_userId_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "userId",
ADD COLUMN     "blackPlayerId" TEXT,
ADD COLUMN     "currentTurn" TEXT NOT NULL DEFAULT 'w',
ADD COLUMN     "gameType" TEXT NOT NULL DEFAULT 'vs_stockfish',
ADD COLUMN     "whitePlayerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
