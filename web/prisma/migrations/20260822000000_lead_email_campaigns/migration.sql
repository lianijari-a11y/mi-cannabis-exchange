-- AlterTable
ALTER TABLE "leads" ADD COLUMN "emailUnsubscribedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lead_message_campaigns" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'sms';
ALTER TABLE "lead_message_campaigns" ADD COLUMN "subject" TEXT;
