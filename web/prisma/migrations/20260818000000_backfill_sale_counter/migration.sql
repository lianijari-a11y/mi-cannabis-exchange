-- Backfill sale_counters for any retailer with Sale rows created before the
-- SaleCounter model existed. Without this, createSale's upsert takes the
-- "create" branch (value=1) for such a retailer even though saleNumber=1
-- (or higher) is already taken, throwing a unique-constraint violation on
-- (retailerId, saleNumber) at checkout — a real bug caught during live
-- browser verification, not a hypothetical. Idempotent: safe to re-run,
-- and correct for a retailer with no SaleCounter row yet as well as one
-- whose counter has somehow fallen behind their actual max saleNumber.
INSERT INTO "sale_counters" ("retailerId", "value")
SELECT "retailerId", MAX("saleNumber")
FROM "sales"
GROUP BY "retailerId"
ON CONFLICT ("retailerId") DO UPDATE SET "value" = GREATEST("sale_counters"."value", EXCLUDED."value");
