-- AlterTable
-- users.minimumOrderValue (added in the previous migration, never used by
-- any shipped code) is replaced by a per-listing model instead of a
-- per-grower dollar floor — see the comment on Listing.minimumOrderQuantity.
ALTER TABLE "users" DROP COLUMN "minimumOrderValue";

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "minimumOrderQuantity" DOUBLE PRECISION,
ADD COLUMN     "belowMinimumPricePerUnit" DOUBLE PRECISION;
