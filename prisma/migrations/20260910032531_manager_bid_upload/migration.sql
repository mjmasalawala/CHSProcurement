-- CreateEnum
CREATE TYPE "BidSubmissionMethod" AS ENUM ('VENDOR_PORTAL', 'MANAGER_UPLOAD');

-- DropForeignKey
ALTER TABLE "Bid" DROP CONSTRAINT "Bid_submittedByUserId_fkey";

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "sourceDocumentUrl" TEXT,
ADD COLUMN     "submittedVia" "BidSubmissionMethod" NOT NULL DEFAULT 'VENDOR_PORTAL',
ADD COLUMN     "uploadedByUserId" TEXT,
ALTER COLUMN "submittedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
