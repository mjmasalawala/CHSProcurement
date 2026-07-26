-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "gstCompliant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "societyGstNumberSnapshot" TEXT,
ADD COLUMN     "vendorGstNumberSnapshot" TEXT;

-- AlterTable
ALTER TABLE "BidDraft" ADD COLUMN     "gstCompliant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstNumber" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "BidDraftLineItem" ADD COLUMN     "gstRate" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "BidLineItem" ADD COLUMN     "gstAmount" DECIMAL(12,2),
ADD COLUMN     "gstRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Society" ADD COLUMN     "gstNumber" TEXT;
