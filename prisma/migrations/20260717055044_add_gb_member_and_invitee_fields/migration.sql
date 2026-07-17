-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'GB_MEMBER';

-- AlterTable
ALTER TABLE "Society" ADD COLUMN     "inviteeEmail" TEXT,
ADD COLUMN     "inviteeName" TEXT,
ADD COLUMN     "inviteePhone" TEXT,
ADD COLUMN     "inviteeRole" "RoleName";
