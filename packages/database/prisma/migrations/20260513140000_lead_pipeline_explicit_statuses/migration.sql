-- ActivityType: LEAD_UPDATED
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ActivityType'
      AND e.enumlabel = 'LEAD_UPDATED'
  ) THEN
    ALTER TYPE "ActivityType" ADD VALUE 'LEAD_UPDATED';
  END IF;
END $$;

-- Reemplazar LeadStatus (pipeline explícito) y eliminar CloseSubstatus
CREATE TYPE "LeadStatus_new" AS ENUM (
  'NEW',
  'CONTACTED',
  'RESPONDED',
  'SCHEDULED',
  'FOLLOW_UP',
  'CLOSED_INVESTED',
  'CLOSED_NOT_INVESTED'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE
    WHEN ("status")::text = 'CLOSED' AND "closeSubstatus"::text = 'INVESTED' THEN 'CLOSED_INVESTED'::"LeadStatus_new"
    WHEN ("status")::text = 'CLOSED' AND "closeSubstatus"::text = 'NOT_INVESTED_TEMPORARY' THEN 'FOLLOW_UP'::"LeadStatus_new"
    WHEN ("status")::text = 'CLOSED' AND "closeSubstatus"::text = 'NOT_INVESTED_FINAL' THEN 'CLOSED_NOT_INVESTED'::"LeadStatus_new"
    WHEN ("status")::text = 'CLOSED' THEN 'CLOSED_NOT_INVESTED'::"LeadStatus_new"
    ELSE ("status")::text::"LeadStatus_new"
  END
);

ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW'::"LeadStatus_new";

ALTER TABLE "Lead" DROP COLUMN IF EXISTS "closeSubstatus";

DROP TYPE IF EXISTS "CloseSubstatus";

DROP TYPE "LeadStatus";

ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
