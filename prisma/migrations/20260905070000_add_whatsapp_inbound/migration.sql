-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'NEEDS_HUMAN', 'CLOSED');

-- CreateEnum
CREATE TYPE "InboundMessageType" AS ENUM ('TEXT', 'BUTTON', 'INTERACTIVE', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "InboundHandledBy" AS ENUM ('AUTO_RULE', 'HUMAN', 'UNHANDLED');

-- AlterTable
ALTER TABLE "ContactPreference" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "userId" TEXT,
    "vendorCompanyId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "type" "InboundMessageType" NOT NULL,
    "text" TEXT,
    "buttonPayload" TEXT,
    "intent" TEXT,
    "handledBy" "InboundHandledBy" NOT NULL DEFAULT 'UNHANDLED',
    "autoReplyText" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_phoneE164_key" ON "Conversation"("phoneE164");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_providerMessageId_key" ON "InboundMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "InboundMessage_conversationId_idx" ON "InboundMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPreference_phone_key" ON "ContactPreference"("phone");

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

