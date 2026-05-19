-- Multiservicio: ServiceCategory + Lead.serviceCategoryId
-- Renombrar cierres: CLOSED_INVESTED → CLOSED_SUCCESS, CLOSED_NOT_INVESTED → CLOSED_LOST

CREATE TABLE "ServiceCategory" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "color"     TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

INSERT INTO "ServiceCategory" ("id", "name", "slug", "color", "isActive", "createdAt", "updatedAt")
VALUES
  ('svc_inversiones', 'Inversiones', 'inversiones', '#6B9BD1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_charlas', 'Charlas', 'charlas', '#9B7ED4', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_contabilidad', 'Contabilidad', 'contabilidad', '#5DAA8A', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Lead" ADD COLUMN "serviceCategoryId" TEXT;

UPDATE "Lead" SET "serviceCategoryId" = 'svc_inversiones' WHERE "serviceCategoryId" IS NULL;

ALTER TABLE "Lead" ALTER COLUMN "serviceCategoryId" SET NOT NULL;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceCategoryId_fkey"
  FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Lead_serviceCategoryId_idx" ON "Lead"("serviceCategoryId");

-- Renombrar estados de cierre
CREATE TYPE "LeadStatus_new" AS ENUM (
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'FOLLOW_UP',
  'CLOSED_SUCCESS',
  'CLOSED_LOST'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE ("status")::text
    WHEN 'CLOSED_INVESTED' THEN 'CLOSED_SUCCESS'::"LeadStatus_new"
    WHEN 'CLOSED_NOT_INVESTED' THEN 'CLOSED_LOST'::"LeadStatus_new"
    ELSE ("status")::text::"LeadStatus_new"
  END
);

ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW'::"LeadStatus_new";

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
