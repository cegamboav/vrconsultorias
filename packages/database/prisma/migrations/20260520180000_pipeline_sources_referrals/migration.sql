-- Consolidar pipeline: eliminar RESPONDED (mapear a CONTACTED)
CREATE TYPE "LeadStatus_new" AS ENUM (
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'FOLLOW_UP',
  'CLOSED_INVESTED',
  'CLOSED_NOT_INVESTED'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE ("status")::text
    WHEN 'RESPONDED' THEN 'CONTACTED'::"LeadStatus_new"
    ELSE ("status")::text::"LeadStatus_new"
  END
);

ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW'::"LeadStatus_new";

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

-- Fuentes de lead (español en enum)
CREATE TYPE "LeadSource_new" AS ENUM (
  'REFERIDO',
  'DIRECTO',
  'PAGINA_WEB',
  'REDES_SOCIALES',
  'OTRO'
);

ALTER TABLE "Lead" ALTER COLUMN "source" TYPE "LeadSource_new" USING (
  CASE ("source")::text
    WHEN 'REFERRAL' THEN 'REFERIDO'::"LeadSource_new"
    WHEN 'DIRECT' THEN 'DIRECTO'::"LeadSource_new"
    WHEN 'ORGANIC' THEN 'PAGINA_WEB'::"LeadSource_new"
    WHEN 'OTHER' THEN 'OTRO'::"LeadSource_new"
    ELSE 'OTRO'::"LeadSource_new"
  END
);

DROP TYPE "LeadSource";
ALTER TYPE "LeadSource_new" RENAME TO "LeadSource";

-- Referido por otro lead (relación opcional)
ALTER TABLE "Lead" ADD COLUMN "referredByLeadId" TEXT;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_referredByLeadId_fkey" FOREIGN KEY ("referredByLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice sobre la columna recién creada (movido desde la migración huérfana 20260513201722_)
CREATE INDEX "Lead_referredByLeadId_idx" ON "Lead"("referredByLeadId");
