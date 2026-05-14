-- Contador de seguimientos: cuántas veces el lead pasó al estado FOLLOW_UP.
ALTER TABLE "Lead" ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0;
