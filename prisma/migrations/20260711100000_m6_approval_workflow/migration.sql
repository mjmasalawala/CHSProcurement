-- CreateEnum
CREATE TYPE "ProposedChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'AWAITING_APPROVAL', 'RETURNED_TO_MANAGER', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FinalizationMethod" AS ENUM ('AUTO_BELOW_THRESHOLD', 'OB_APPROVAL');

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "ProposedChange" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" "ProposedChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ProposedChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationApproval" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "officeBearerUserId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "finalizedVia" "FinalizationMethod" NOT NULL,
    "approvalSummary" TEXT NOT NULL,
    "justificationNote" TEXT,
    "societyNameSnapshot" TEXT NOT NULL,
    "societyAddressSnapshot" TEXT NOT NULL,
    "vendorNameSnapshot" TEXT NOT NULL,
    "vendorAddressSnapshot" TEXT NOT NULL,
    "vendorContactSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuotationApproval_requirementId_officeBearerUserId_key" ON "QuotationApproval"("requirementId", "officeBearerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_requirementId_key" ON "WorkOrder"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_bidId_key" ON "WorkOrder"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- AddForeignKey
ALTER TABLE "ProposedChange" ADD CONSTRAINT "ProposedChange_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedChange" ADD CONSTRAINT "ProposedChange_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedChange" ADD CONSTRAINT "ProposedChange_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_officeBearerUserId_fkey" FOREIGN KEY ("officeBearerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

