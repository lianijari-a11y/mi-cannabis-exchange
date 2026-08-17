-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sms_connections" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "fromPhoneNumber" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_messages" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_connections_retailerId_key" ON "sms_connections"("retailerId");

-- AddForeignKey
ALTER TABLE "sms_connections" ADD CONSTRAINT "sms_connections_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_messages" ADD CONSTRAINT "marketing_messages_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
