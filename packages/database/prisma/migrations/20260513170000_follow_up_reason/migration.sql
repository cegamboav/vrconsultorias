-- Motivo de seguimiento (pausa con causa explícita)
CREATE TYPE "FollowUpReason" AS ENUM (
  'NO_RESPONSE',
  'NO_MONEY',
  'CALL_LATER',
  'THINKING',
  'BUSY',
  'OTHER'
);

ALTER TABLE "Lead" ADD COLUMN "followUpReason" "FollowUpReason";
