-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'SUPPORT';

-- CreateTable
CREATE TABLE "ImpersonationEvent" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationEvent_token_key" ON "ImpersonationEvent"("token");

-- CreateIndex
CREATE INDEX "ImpersonationEvent_token_idx" ON "ImpersonationEvent"("token");

-- CreateIndex
CREATE INDEX "ImpersonationEvent_adminUserId_idx" ON "ImpersonationEvent"("adminUserId");

-- AddForeignKey
ALTER TABLE "ImpersonationEvent" ADD CONSTRAINT "ImpersonationEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationEvent" ADD CONSTRAINT "ImpersonationEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
