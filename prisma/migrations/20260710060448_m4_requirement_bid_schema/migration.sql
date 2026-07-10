-- CreateEnum
CREATE TYPE "RequirementUrgency" AS ENUM ('ROUTINE', 'URGENT');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'WON', 'NOT_SELECTED');

-- AlterEnum
ALTER TYPE "RoleAssignmentStatus" ADD VALUE 'DEACTIVATED';

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" "RequirementUrgency" NOT NULL,
    "budgetBand" TEXT,
    "bidDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementInvite" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "vendorCompanyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "vendorCompanyId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "bidValidity" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidLineItem" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "BidLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequirementInvite_requirementId_vendorCompanyId_key" ON "RequirementInvite"("requirementId", "vendorCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_requirementId_vendorCompanyId_key" ON "Bid"("requirementId", "vendorCompanyId");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementInvite" ADD CONSTRAINT "RequirementInvite_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementInvite" ADD CONSTRAINT "RequirementInvite_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidLineItem" ADD CONSTRAINT "BidLineItem_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
