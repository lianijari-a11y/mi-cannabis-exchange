-- CreateTable
CREATE TABLE "lead_message_campaigns" (
    "id" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "templateText" TEXT NOT NULL,
    "personalized" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "lead_message_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_message_campaign_items" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "lead_message_campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_message_campaigns_status_scheduledFor_idx" ON "lead_message_campaigns"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "lead_message_campaign_items_campaignId_idx" ON "lead_message_campaign_items"("campaignId");

-- CreateIndex
CREATE INDEX "lead_message_campaign_items_leadId_idx" ON "lead_message_campaign_items"("leadId");

-- AddForeignKey
ALTER TABLE "lead_message_campaigns" ADD CONSTRAINT "lead_message_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_message_campaign_items" ADD CONSTRAINT "lead_message_campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "lead_message_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_message_campaign_items" ADD CONSTRAINT "lead_message_campaign_items_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
