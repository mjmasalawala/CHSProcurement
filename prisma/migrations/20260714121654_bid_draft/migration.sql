-- CreateTable
CREATE TABLE "BidDraft" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "vendorCompanyId" TEXT NOT NULL,
    "bidValidity" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "suggestionGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidDraftLineItem" (
    "id" TEXT NOT NULL,
    "bidDraftId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitRate" TEXT NOT NULL,

    CONSTRAINT "BidDraftLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BidDraft_requirementId_vendorCompanyId_key" ON "BidDraft"("requirementId", "vendorCompanyId");

-- AddForeignKey
ALTER TABLE "BidDraft" ADD CONSTRAINT "BidDraft_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidDraft" ADD CONSTRAINT "BidDraft_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidDraftLineItem" ADD CONSTRAINT "BidDraftLineItem_bidDraftId_fkey" FOREIGN KEY ("bidDraftId") REFERENCES "BidDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
