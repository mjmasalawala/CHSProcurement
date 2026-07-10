-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recommendationNote" TEXT,
ADD COLUMN     "recommendedAt" TIMESTAMP(3),
ADD COLUMN     "recommendedBidId" TEXT,
ADD COLUMN     "recommendedByUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_recommendedBidId_key" ON "Requirement"("recommendedBidId");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_recommendedBidId_fkey" FOREIGN KEY ("recommendedBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_recommendedByUserId_fkey" FOREIGN KEY ("recommendedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

