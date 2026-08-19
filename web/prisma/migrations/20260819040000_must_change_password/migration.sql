-- AlterTable
-- Drives the license-first inline sign-in flow on public menu/collection
-- links: an account whose password was set by an Admin/AE (a quick-signup
-- temp password, or a reset) gets prompted to choose their own password
-- instead of being asked for the temporary one.
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
