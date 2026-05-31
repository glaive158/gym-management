-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "gymQuota" INTEGER NOT NULL DEFAULT 1;

-- Grandfather existing tenants: set gymQuota to their current gym count
-- (minimum 1) so previously-created gyms remain valid.
UPDATE "Tenant" t
SET "gymQuota" = GREATEST(
  1,
  (SELECT COUNT(*)::int FROM "Gym" g WHERE g."tenantId" = t.id)
);
