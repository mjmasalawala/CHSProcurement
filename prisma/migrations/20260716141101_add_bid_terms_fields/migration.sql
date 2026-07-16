-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "completionTime" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "warrantyPeriod" TEXT;

-- AlterTable
ALTER TABLE "BidDraft" ADD COLUMN     "completionTime" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentTerms" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "warrantyPeriod" TEXT NOT NULL DEFAULT '';
