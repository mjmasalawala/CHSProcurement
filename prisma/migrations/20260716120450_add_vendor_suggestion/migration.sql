-- CreateTable
CREATE TABLE "VendorSuggestion" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "suggestedByUserId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorPhone" TEXT,
    "vendorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorSuggestion_societyId_idx" ON "VendorSuggestion"("societyId");

-- AddForeignKey
ALTER TABLE "VendorSuggestion" ADD CONSTRAINT "VendorSuggestion_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSuggestion" ADD CONSTRAINT "VendorSuggestion_suggestedByUserId_fkey" FOREIGN KEY ("suggestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
