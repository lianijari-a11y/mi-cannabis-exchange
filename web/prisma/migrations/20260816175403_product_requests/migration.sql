-- CreateTable
CREATE TABLE "product_requests" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "category" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "termsPreference" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "listingId" TEXT,
    "price" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_request_responses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_responses" ADD CONSTRAINT "product_request_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_responses" ADD CONSTRAINT "product_request_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_responses" ADD CONSTRAINT "product_request_responses_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
