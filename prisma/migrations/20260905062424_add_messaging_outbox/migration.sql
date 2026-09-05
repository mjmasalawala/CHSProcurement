-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('TRANSACTIONAL', 'REMINDER', 'MARKETING');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('RESEND', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "category" "MessageCategory" NOT NULL DEFAULT 'TRANSACTIONAL',
    "templateKey" TEXT NOT NULL,
    "to" TEXT[],
    "subject" TEXT,
    "html" TEXT,
    "text" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "skippedReason" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "dedupeKey" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPreference" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "messageLanguage" TEXT NOT NULL DEFAULT 'EN',
    "subscribedMarketing" BOOLEAN NOT NULL DEFAULT true,
    "emailMarketingOptOutAt" TIMESTAMP(3),
    "emailSuppressedAt" TIMESTAMP(3),
    "suppressionReason" TEXT,
    "whatsappOptInAt" TIMESTAMP(3),
    "whatsappOptOutAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Message_dedupeKey_key" ON "Message"("dedupeKey");

-- CreateIndex
CREATE INDEX "Message_status_sendAfter_idx" ON "Message"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "Message_templateKey_idx" ON "Message"("templateKey");

-- CreateIndex
CREATE INDEX "Message_providerId_idx" ON "Message"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPreference_email_key" ON "ContactPreference"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPreference_unsubscribeToken_key" ON "ContactPreference"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
