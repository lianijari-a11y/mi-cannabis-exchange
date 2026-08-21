-- AlterTable
-- Per-number suppression, set automatically by an inbound "wrong number" /
-- "stop" reply (lib/vonage-inbound.ts). A blocked number is never texted
-- again by sendSmsToLead, even if a caller still has it on hand.
ALTER TABLE "lead_phone_numbers" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lead_phone_numbers" ADD COLUMN "blockedReason" TEXT;
