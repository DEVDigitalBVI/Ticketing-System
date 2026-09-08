ALTER TABLE "service_desk"."tickets"
ADD COLUMN "primary_asset_id" UUID;

ALTER TABLE "service_desk"."level_device_inventory"
ADD COLUMN "last_successful_sync_at" TIMESTAMPTZ(6);

UPDATE "service_desk"."level_device_inventory"
SET "last_successful_sync_at" = "last_synced_at"
WHERE "sync_state" <> 'failed';

CREATE INDEX "tickets_primary_asset_id_organization_id_idx"
ON "service_desk"."tickets"("primary_asset_id", "organization_id");

ALTER TABLE "service_desk"."tickets"
ADD CONSTRAINT "tickets_primary_asset_id_organization_id_fkey"
FOREIGN KEY ("primary_asset_id", "organization_id")
REFERENCES "service_desk"."assets"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
