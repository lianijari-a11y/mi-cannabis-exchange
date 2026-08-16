-- CreateTable
CREATE TABLE "metrc_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "userApiKey" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrc_vendor_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "vendorApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrc_vendor_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metrc_connections_userId_key" ON "metrc_connections"("userId");

-- AddForeignKey
ALTER TABLE "metrc_connections" ADD CONSTRAINT "metrc_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
