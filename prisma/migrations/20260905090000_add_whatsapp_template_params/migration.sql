-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "whatsappTemplateParams" TEXT[] DEFAULT ARRAY[]::TEXT[];

