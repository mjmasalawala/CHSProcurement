-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('VENDOR_COMPANY', 'SOCIETY', 'PLATFORM');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('VENDOR_OWNER', 'VENDOR_STAFF', 'MANAGER', 'CHAIRMAN', 'SECRETARY', 'TREASURER', 'OPS_VENDOR_QUEUE', 'OPS_SOCIETY_QUEUE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "RoleAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT,
    "role" "RoleName" NOT NULL,
    "permissions" TEXT[],
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_entityType_entityId_idx" ON "RoleAssignment"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
