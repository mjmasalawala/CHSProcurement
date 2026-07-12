-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "deadlineClosedNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "deadlineReminderSentAt" TIMESTAMP(3);
